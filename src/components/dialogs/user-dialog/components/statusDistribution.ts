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
function confirmedStatusIntervals(
    rows: readonly FeedRowOutput[],
    targetUserId: string,
    now = Date.now(),
    currentState?: string
): Array<{ start: number; end: number; status: StatusDistributionKey }> {
    if (!Number.isFinite(now)) {
        return [];
    }
    const statusRows = sortedStatusRows(rows, targetUserId);
    if (!statusRows.length) {
        return [];
    }

    const confirmed: Array<{
        start: number;
        end: number;
        status: StatusDistributionKey;
    }> = [];
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
        confirmed.push(
            ...intervals.map((interval) => ({
                ...interval,
                status: current.status!
            }))
        );
    }
    return confirmed;
}

export function buildStatusDistribution(
    rows: readonly FeedRowOutput[],
    targetUserId: string,
    now = Date.now(),
    currentState?: string
): StatusDistributionRow[] {
    const totals = new Map<StatusDistributionKey, number>();
    for (const interval of confirmedStatusIntervals(
        rows,
        targetUserId,
        now,
        currentState
    )) {
        totals.set(
            interval.status,
            (totals.get(interval.status) || 0) +
                (interval.end - interval.start) / 1000
        );
    }

    return STATUS_DISTRIBUTION_KEYS.map((status) => ({
        status,
        seconds: Math.round(totals.get(status) || 0)
    })).filter((row) => row.seconds > 0);
}

export const STATUS_DISTRIBUTION_COLORS: Record<StatusDistributionKey, string> =
    {
        'join me': '#00B8FF',
        active: '#2ED319',
        'ask me': '#E97C03',
        busy: '#C80928'
    };

export function statusBucketDays(slider: number) {
    return Math.max(
        1,
        Math.round(Math.pow(90, Math.max(0, Math.min(100, slider)) / 100))
    );
}

export type StatusDistributionBucket = {
    label: string;
    seconds: Record<StatusDistributionKey, number>;
    totalSeconds: number;
    percentages: Record<StatusDistributionKey, number>;
};

/** UTC calendar buckets, using exactly the same confirmed intersections as totals.
 * Unknown/offline time is excluded from the denominator, never filled in.
 */
export function buildStatusDistributionBuckets(
    rows: readonly FeedRowOutput[],
    targetUserId: string,
    bucketDays: number,
    now = Date.now(),
    currentState?: string
): StatusDistributionBucket[] {
    const intervals = confirmedStatusIntervals(
        rows,
        targetUserId,
        now,
        currentState
    );
    if (!intervals.length || !Number.isFinite(bucketDays)) return [];
    const dayMs = 86400000;
    const days = Math.max(1, Math.round(bucketDays));
    const width = days * dayMs;
    const first =
        Math.floor(
            intervals.reduce(
                (min, entry) => Math.min(min, entry.start),
                Infinity
            ) / dayMs
        ) * dayMs;
    const last = intervals.reduce(
        (max, entry) => Math.max(max, entry.end),
        -Infinity
    );
    const date = (ms: number) => new Date(ms).toISOString().slice(0, 10);
    const empty = (): Record<StatusDistributionKey, number> => ({
        'join me': 0,
        active: 0,
        'ask me': 0,
        busy: 0
    });
    const buckets: StatusDistributionBucket[] = Array.from(
        { length: Math.ceil((last - first) / width) },
        (_, index) => ({
            label:
                days === 1
                    ? date(first + index * width)
                    : `${date(first + index * width)}~${date(first + (index + 1) * width - dayMs)}`,
            seconds: empty(),
            totalSeconds: 0,
            percentages: empty()
        })
    );
    for (const interval of intervals) {
        let start = interval.start;
        while (start < interval.end) {
            const index = Math.floor((start - first) / width);
            const end = Math.min(interval.end, first + (index + 1) * width);
            const seconds = (end - start) / 1000;
            buckets[index].seconds[interval.status] += seconds;
            buckets[index].totalSeconds += seconds;
            start = end;
        }
    }
    for (const bucket of buckets) {
        for (const status of STATUS_DISTRIBUTION_KEYS) {
            bucket.percentages[status] =
                bucket.totalSeconds > 0
                    ? (bucket.seconds[status] / bucket.totalSeconds) * 100
                    : 0;
        }
    }
    return buckets;
}
