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

type TimedStatus = { at: number; status: StatusDistributionKey };
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
            const status = normalizedStatus(row.status);
            return at === null || !status ? null : { at, status };
        })
        .filter((row): row is TimedStatus => row !== null)
        .sort((left, right) => left.at - right.at);
}

function sortedPresenceRows(
    rows: readonly FeedRowOutput[],
    targetUserId: string
) {
    return rows
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
        .sort((left, right) => left.at - right.at);
}

function onlineIntervals(rows: readonly TimedPresence[], now: number) {
    const intervals: Array<{ start: number; end: number }> = [];
    let onlineAt: number | null = null;
    for (const row of rows) {
        if (row.type === 'Online') {
            if (onlineAt !== null && row.at > onlineAt) {
                intervals.push({ start: onlineAt, end: row.at });
            }
            onlineAt = row.at;
        } else if (onlineAt !== null) {
            if (row.at > onlineAt) {
                intervals.push({ start: onlineAt, end: row.at });
            }
            onlineAt = null;
        }
    }
    if (onlineAt !== null && now > onlineAt) {
        intervals.push({ start: onlineAt, end: now });
    }
    return intervals;
}

/**
 * Estimates time spent in each VRChat status from observed Feed history.
 * When online/offline events exist, status intervals are intersected with them;
 * otherwise a status change is treated as observed until the next change.
 */
export function buildStatusDistribution(
    rows: readonly FeedRowOutput[],
    targetUserId: string,
    now = Date.now()
): StatusDistributionRow[] {
    const statusRows = sortedStatusRows(rows, targetUserId);
    if (!statusRows.length) {
        return [];
    }

    const totals = new Map<StatusDistributionKey, number>(
        STATUS_DISTRIBUTION_KEYS.map((status) => [status, 0])
    );
    const presenceIntervals = onlineIntervals(
        sortedPresenceRows(rows, targetUserId),
        now
    );

    for (let index = 0; index < statusRows.length; index += 1) {
        const current = statusRows[index];
        const end = Math.min(statusRows[index + 1]?.at ?? now, now);
        if (end <= current.at) {
            continue;
        }
        const intervals = presenceIntervals.length
            ? presenceIntervals
                  .map(({ start, end: onlineEnd }) => ({
                      start: Math.max(start, current.at),
                      end: Math.min(onlineEnd, end)
                  }))
                  .filter((interval) => interval.end > interval.start)
            : [{ start: current.at, end }];
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
