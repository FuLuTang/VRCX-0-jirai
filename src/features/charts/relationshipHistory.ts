import type { FeedRowOutput } from '@/platform/tauri/bindings';
import { DAY_MS } from '@/shared/constants/time';
import { isRealInstance } from '@/shared/utils/instance';

export type RelationshipSession = {
    userId: string;
    displayName: string;
    location: string;
    worldName: string;
    startMs: number;
    endMs: number;
    durationMs: number;
};

export type RelationshipOverlap = {
    location: string;
    worldName: string;
    startMs: number;
    endMs: number;
    durationMs: number;
    left: RelationshipSession;
    right: RelationshipSession;
};

export type RelationshipLocationSummary = {
    location: string;
    worldName: string;
    firstSeenMs: number;
    lastSeenMs: number;
    totalDurationMs: number;
    overlapCount: number;
};

export type RelationshipDailyValue = {
    userId: string;
    displayName: string;
    day: number;
    totalTime: number;
    joinCount: number;
};

export type RelationshipTimelineSeries = {
    id: string;
    name: string;
    color: string;
    values: number[];
    total: number;
};

export type RelationshipTimelineData = {
    labels: string[];
    series: RelationshipTimelineSeries[];
};

const COLORS = [
    '#5470c6',
    '#91cc75',
    '#fac858',
    '#ee6666',
    '#73c0de',
    '#3ba272',
    '#fc8452',
    '#9a60b4',
    '#ea7ccc',
    '#17c0ac'
];

function timestamp(value: unknown): number {
    const result = Date.parse(String(value || ''));
    return Number.isFinite(result) ? result : 0;
}

function text(value: unknown): string {
    return String(value || '').trim();
}

/**
 * Feed GPS rows are emitted when a person changes location: `created_at` is
 * the leave time and `time` is the duration spent at `previousLocation`.
 * Offline rows close a session at their `location`. Treating GPS `location`
 * as the session location is the historical bug this module prevents.
 */
export function buildRelationshipSessions(
    rows: readonly FeedRowOutput[]
): RelationshipSession[] {
    const sessions: RelationshipSession[] = [];
    const seen = new Set<string>();

    for (const row of rows) {
        const type = text(row.type);
        const location =
            type === 'GPS'
                ? text(row.previousLocation)
                : type === 'Offline'
                  ? text(row.location)
                  : '';
        const userId = text(row.userId);
        const endMs = timestamp(row.created_at);
        const durationMs = Math.max(0, Number(row.time) || 0);
        if (!userId || !isRealInstance(location) || !endMs || !durationMs) {
            continue;
        }

        const startMs = endMs - durationMs;
        const key = `${userId}\u0000${location}\u0000${startMs}\u0000${endMs}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        sessions.push({
            userId,
            displayName: text(row.displayName) || userId,
            location,
            worldName: text(row.worldName),
            startMs,
            endMs,
            durationMs
        });
    }

    return sessions.sort((left, right) => right.endMs - left.endMs);
}

export function findRelationshipOverlaps(
    leftSessions: readonly RelationshipSession[],
    rightSessions: readonly RelationshipSession[]
): RelationshipOverlap[] {
    const rightByLocation = new Map<string, RelationshipSession[]>();
    for (const session of rightSessions) {
        const values = rightByLocation.get(session.location) || [];
        values.push(session);
        rightByLocation.set(session.location, values);
    }

    const overlaps: RelationshipOverlap[] = [];
    for (const left of leftSessions) {
        for (const right of rightByLocation.get(left.location) || []) {
            const startMs = Math.max(left.startMs, right.startMs);
            const endMs = Math.min(left.endMs, right.endMs);
            if (endMs <= startMs) {
                continue;
            }
            overlaps.push({
                location: left.location,
                worldName: left.worldName || right.worldName,
                startMs,
                endMs,
                durationMs: endMs - startMs,
                left,
                right
            });
        }
    }

    return overlaps.sort((left, right) => right.endMs - left.endMs);
}

export function summarizeRelationshipOverlaps(
    overlaps: readonly RelationshipOverlap[]
): RelationshipLocationSummary[] {
    const summaries = new Map<string, RelationshipLocationSummary>();
    for (const overlap of overlaps) {
        const existing = summaries.get(overlap.location);
        if (existing) {
            existing.firstSeenMs = Math.min(
                existing.firstSeenMs,
                overlap.startMs
            );
            existing.lastSeenMs = Math.max(existing.lastSeenMs, overlap.endMs);
            existing.totalDurationMs += overlap.durationMs;
            existing.overlapCount += 1;
            if (!existing.worldName && overlap.worldName) {
                existing.worldName = overlap.worldName;
            }
            continue;
        }
        summaries.set(overlap.location, {
            location: overlap.location,
            worldName: overlap.worldName,
            firstSeenMs: overlap.startMs,
            lastSeenMs: overlap.endMs,
            totalDurationMs: overlap.durationMs,
            overlapCount: 1
        });
    }

    return Array.from(summaries.values()).sort(
        (left, right) => right.lastSeenMs - left.lastSeenMs
    );
}

/** Splits sessions at UTC day boundaries for an accurate relationship timeline. */
export function buildRelationshipDailyValues(
    sessions: readonly RelationshipSession[]
): RelationshipDailyValue[] {
    const values = new Map<string, RelationshipDailyValue>();

    for (const session of sessions) {
        let cursor = session.startMs;
        let isFirstSegment = true;
        while (cursor < session.endMs) {
            const day = Math.floor(cursor / DAY_MS);
            const nextDay = (day + 1) * DAY_MS;
            const endMs = Math.min(session.endMs, nextDay);
            const key = `${session.userId}\u0000${day}`;
            const value = values.get(key) || {
                userId: session.userId,
                displayName: session.displayName,
                day,
                totalTime: 0,
                joinCount: 0
            };
            value.totalTime += endMs - cursor;
            if (isFirstSegment) {
                value.joinCount += 1;
            }
            values.set(key, value);
            cursor = endMs;
            isFirstSegment = false;
        }
    }

    return Array.from(values.values());
}

export function relationshipScore(totalTime: number, joinCount: number) {
    return Math.max(0, totalTime) + Math.max(0, joinCount) * 60_000;
}

function dayLabel(day: number, bucketDays: number) {
    const format = (value: number) =>
        new Date(value * DAY_MS).toISOString().slice(0, 10);
    return bucketDays === 1
        ? format(day)
        : `${format(day)} ~ ${format(day + bucketDays - 1)}`;
}

/**
 * Preserves the vrcx-0-jirai timeline rule: choose Top-N independently for
 * each time bucket, then render the union of those people. This avoids the
 * misleading "every historical user at once" stacked chart.
 */
export function buildRelationshipTimeline(
    values: readonly RelationshipDailyValue[],
    bucketDays: number,
    topCount: number,
    showOthers: boolean,
    resolveDisplayName: (userId: string, fallback: string) => string = (
        _userId,
        fallback
    ) => fallback
): RelationshipTimelineData {
    if (!values.length) {
        return { labels: [], series: [] };
    }

    const normalizedBucketDays = Math.max(1, Math.floor(bucketDays));
    const firstDay = Math.min(...values.map((value) => value.day));
    const lastDay = Math.max(...values.map((value) => value.day));
    const bucketCount =
        Math.floor((lastDay - firstDay) / normalizedBucketDays) + 1;
    const buckets = Array.from(
        { length: bucketCount },
        () => new Map<string, { displayName: string; score: number }>()
    );

    for (const value of values) {
        const index = Math.floor((value.day - firstDay) / normalizedBucketDays);
        const bucket = buckets[index];
        const previous = bucket.get(value.userId);
        bucket.set(value.userId, {
            displayName: previous?.displayName || value.displayName,
            score:
                (previous?.score || 0) +
                relationshipScore(value.totalTime, value.joinCount)
        });
    }

    const selected = new Map<string, RelationshipTimelineSeries>();
    const others = Array.from({ length: bucketCount }, () => 0);
    for (let index = 0; index < bucketCount; index += 1) {
        const ordered = [...buckets[index].entries()].sort(
            (left, right) => right[1].score - left[1].score
        );
        const top = ordered.slice(0, Math.max(1, topCount));
        const topTotal = top.reduce((sum, [, value]) => sum + value.score, 0);
        const allTotal = ordered.reduce(
            (sum, [, value]) => sum + value.score,
            0
        );
        const otherScore = Math.max(0, allTotal - topTotal);
        const denominator = topTotal + (showOthers ? otherScore : 0);

        for (const [userId, value] of top) {
            const entry = selected.get(userId) || {
                id: userId,
                name: value.displayName,
                color: '',
                values: Array.from({ length: bucketCount }, () => 0),
                total: 0
            };
            entry.values[index] = denominator
                ? Number(((value.score / denominator) * 100).toFixed(2))
                : 0;
            entry.total += value.score;
            selected.set(userId, entry);
        }
        others[index] = denominator
            ? Number(((otherScore / denominator) * 100).toFixed(2))
            : 0;
    }

    const orderedIds = [...selected.values()]
        .sort(
            (left, right) =>
                right.total - left.total || left.id.localeCompare(right.id)
        )
        .map((entry) => entry.id);
    const series: RelationshipTimelineSeries[] = [];
    if (showOthers && others.some((value) => value > 0)) {
        series.push({
            id: 'others',
            name: 'Others',
            color: '#aaaaaa',
            values: others,
            total: 0
        });
    }
    for (let index = orderedIds.length - 1; index >= 0; index -= 1) {
        const entry = selected.get(orderedIds[index]);
        if (!entry) {
            continue;
        }
        series.push({
            ...entry,
            name: resolveDisplayName(entry.id, entry.name),
            color: COLORS[index % COLORS.length]
        });
    }

    return {
        labels: Array.from({ length: bucketCount }, (_, index) =>
            dayLabel(
                firstDay + index * normalizedBucketDays,
                normalizedBucketDays
            )
        ),
        series
    };
}

export function initialRelationshipTimelineZoom(bucketCount: number) {
    const defaultVisibleBuckets = 10;
    return bucketCount <= defaultVisibleBuckets
        ? { start: 0, end: 100 }
        : {
              start:
                  ((bucketCount - defaultVisibleBuckets) / bucketCount) * 100,
              end: 100
          };
}
