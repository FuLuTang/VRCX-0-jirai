type MutualRow = {
    id?: string;
    displayName?: string;
    $mutualObservedAt?: unknown;
    [key: string]: unknown;
};

type HistoricalLink = { mutualId: string; date: string };

export function buildMutualHistoryRows<T extends MutualRow>(
    apiRows: readonly T[],
    apiReady: boolean,
    historicalLinks: readonly HistoricalLink[],
    cachedFriends: Readonly<Record<string, MutualRow>>
) {
    const rows: MutualRow[] = [];
    const currentIds = new Set<string>();
    if (apiReady) {
        for (const row of apiRows) {
            const observedAt = row.$mutualObservedAt;
            if (!row.id || typeof observedAt !== 'string' || !observedAt) {
                continue;
            }
            currentIds.add(row.id);
            rows.push({
                ...row,
                $mutualDate: observedAt,
                $mutualConfirmed: true
            });
        }
    }
    for (const link of historicalLinks) {
        if (!link.mutualId || currentIds.has(link.mutualId)) {
            continue;
        }
        const cached = cachedFriends[link.mutualId];
        rows.push({
            ...cached,
            id: link.mutualId,
            displayName: cached?.displayName || link.mutualId,
            $mutualDate: link.date,
            $mutualConfirmed: false
        });
    }
    return rows;
}
