type TimedDeparture = {
    type: string;
    created_at: string;
    time?: number | null;
};

/** Legacy getMaxPlayerCountForLocations sweep: arrivals win same-time ties.
 * The result is a peak observed in valid local log intervals, not world capacity. */
export function observedPeakPlayerCount(
    rows: readonly TimedDeparture[]
): number | null {
    const events: [number, number][] = [];
    for (const row of rows) {
        const leave = Date.parse(row.created_at);
        const duration = row.time || 0;
        if (
            row.type !== 'OnPlayerLeft' ||
            !Number.isFinite(leave) ||
            !Number.isFinite(duration) ||
            duration <= 0
        )
            continue;
        events.push([leave - duration, 1], [leave, -1]);
    }
    if (!events.length) return null;
    events.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
    let current = 0,
        peak = 0;
    for (const [, delta] of events) {
        current += delta;
        peak = Math.max(peak, current);
    }
    return peak;
}

export function observedJoinOrder(
    left: number,
    right: number
): 'unknown' | 'leftPlayer' | 'rightPlayer' {
    // Nearby Feed observations can be a baseline snapshot, not two actual joins.
    if (
        !Number.isFinite(left) ||
        !Number.isFinite(right) ||
        Math.abs(left - right) <= 180000
    )
        return 'unknown';
    return left > right ? 'leftPlayer' : 'rightPlayer';
}
