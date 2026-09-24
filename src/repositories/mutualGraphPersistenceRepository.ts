import { commands } from '@/platform/tauri/bindings';

type MutualGraphMeta = {
    lastFetchedAt: string | null;
    optedOut: boolean;
    totalCount: number | null;
};

async function getSnapshot(userId: string): Promise<{
    snapshot: Map<string, string[]>;
    historicalLinks: Map<string, string>;
    meta: Map<string, MutualGraphMeta>;
}> {
    const {
        friendIds,
        links,
        historicalLinks: historicalLinkRows,
        meta: metaRows
    } = await commands.appMutualGraphSnapshotGet(userId.trim());

    const snapshot = new Map<string, string[]>();
    const meta = new Map<string, MutualGraphMeta>();
    const historicalLinks = new Map<string, string>();

    for (const friendId of friendIds) {
        if (friendId && !snapshot.has(friendId)) {
            snapshot.set(friendId, []);
        }
    }

    for (const row of links) {
        const friendId = row.friendId;
        const mutualId = row.mutualId;
        if (!friendId || !mutualId) {
            continue;
        }

        const mutualIds = snapshot.get(friendId) ?? [];
        mutualIds.push(mutualId);
        snapshot.set(friendId, mutualIds);
    }

    for (const row of historicalLinkRows) {
        if (!row.friendId || !row.mutualId) {
            continue;
        }
        const key = [row.friendId, row.mutualId].sort().join('__');
        historicalLinks.set(key, row.date);
    }

    for (const row of metaRows) {
        const friendId = row.friendId;
        if (!friendId) {
            continue;
        }

        meta.set(friendId, {
            lastFetchedAt: row.lastFetchedAt || null,
            optedOut: row.optedOut,
            totalCount: row.totalCount
        });
    }

    return {
        snapshot,
        historicalLinks,
        meta
    };
}

const mutualGraphPersistenceRepository = Object.freeze({
    getSnapshot
});

export default mutualGraphPersistenceRepository;
