import type { FeedRowOutput } from '@/platform/tauri/bindings';

export const STATUS_DISTRIBUTION_KEYS = [
    'join me',
    'active',
    'ask me',
    'busy'
] as const;

export type StatusDistributionKey = (typeof STATUS_DISTRIBUTION_KEYS)[number];
export type StatusDistributionRow = {
    status: StatusDistributionKey;
    seconds: number;
};

type TimedStatus = { at: number; status: StatusDistributionKey | null };
type TimedPresence = { at: number; type: 'Online' | 'Offline' };

function normalizedStatus(value: unknown): StatusDistributionKey | null {
    const normalized = String(value || '')
        .trim()
        .toLowerCase();
    return STATUS_DISTRIBUTION_KEYS.includes(
        normalized as StatusDistributionKey
    )
        ? (normalized as StatusDistributionKey)
        : null;
}

function timestamp(value: unknown) {
    const result = Date.parse(String(value || ''));
    return Number.isFinite(result) ? result : null;
}

function sortedStatusRows(
    rows: readonly FeedRowOutput[],
    targetUserId: string
) {
    return rows
        .filter((row) => row.userId === targetUserId && row.type === 'Status')
        .map((row): TimedStatus | null => {
            const at = timestamp(row.created_at);
            return at === null
                ? null
                : { at, status: normalizedStatus(row.status) };
        })
        .filter((row): row is TimedStatus => row !== null)
        .sort((left, right) => left.at - right.at);
}

function sortedPresenceRows(
    rows: readonly FeedRowOutput[],
    targetUserId: string
) {
    return (
        rows
            .filter(
                (row) =>
                    row.userId === targetUserId &&
                    (row.type === 'Online' || row.type === 'Offline')
            )
            .map((row): TimedPresence | null => {
                const at = timestamp(row.created_at);
                if (
                    at === null ||
                    (row.type !== 'Online' && row.type !== 'Offline')
                ) {
                    return null;
                }
                return { at, type: row.type };
            })
            .filter((row): row is TimedPresence => row !== null)
            // At an ambiguous shared timestamp, Offline wins over Online.
            .sort(
                (left, right) =>
                    left.at - right.at ||
                    (left.type === right.type
                        ? 0
                        : left.type === 'Online'
                          ? -1
                          : 1)
            )
    );
}

function onlineIntervals(
    rows: readonly TimedPresence[],
    now: number,
    currentlyOnline: boolean
) {
    const intervals: Array<{ start: number; end: number }> = [];
    let onlineAt: number | null = null;
    for (const row of rows) {
        if (row.at > now) {
            break;
        }
        if (row.type === 'Online') {
            if (onlineAt === null) {
                onlineAt = row.at;
            }
        } else if (onlineAt !== null) {
            if (row.at > onlineAt) {
                intervals.push({ start: onlineAt, end: row.at });
            }
            onlineAt = null;
        }
    }
    if (currentlyOnline && onlineAt !== null && now > onlineAt) {
        intervals.push({ start: onlineAt, end: now });
    }
    return intervals;
}

/**
 * Counts only the intersection of known status and observed online periods.
 * An Online event begins a period that ends at Offline; an open period only
 * extends to now when the current profile state confirms the user is online.
 * An Offline without a preceding Online never establishes online time.
 */
export function buildStatusDistribution(
    rows: readonly FeedRowOutput[],
    targetUserId: string,
    now = Date.now(),
    currentState?: string
): StatusDistributionRow[] {
    if (!Number.isFinite(now)) {
        return [];
    }
    const statusRows = sortedStatusRows(rows, targetUserId);
    if (!statusRows.length) {
        return [];
    }

    const totals = new Map<StatusDistributionKey, number>(
        STATUS_DISTRIBUTION_KEYS.map((status) => [status, 0])
    );
    const presenceIntervals = onlineIntervals(
        sortedPresenceRows(rows, targetUserId),
        now,
        currentState === 'online'
    );
    if (!presenceIntervals.length) {
        return [];
    }

    for (let index = 0; index < statusRows.length; index += 1) {
        const current = statusRows[index];
        const end = Math.min(statusRows[index + 1]?.at ?? now, now);
        if (!current.status || end <= current.at) {
            continue;
        }
        const intervals = presenceIntervals
            .map(({ start, end: onlineEnd }) => ({
                start: Math.max(start, current.at),
                end: Math.min(onlineEnd, end)
            }))
            .filter((interval) => interval.end > interval.start);
        const milliseconds = intervals.reduce(
            (sum, interval) => sum + interval.end - interval.start,
            0
        );
        totals.set(
            current.status,
            (totals.get(current.status) || 0) + milliseconds / 1000
        );
    }

    return STATUS_DISTRIBUTION_KEYS.map((status) => ({
        status,
        seconds: Math.round(totals.get(status) || 0)
    })).filter((row) => row.seconds > 0);
}
