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
    trackedUsers: { userId: string; displayName: string; addedAt: string }[];
    manualLinks: {
        userIdA: string;
        userIdB: string;
        relationType: string;
        addedAt: string;
    }[];
}> {
    const {
        friendIds,
        links,
        historicalLinks: historicalLinkRows,
        meta: metaRows
    } = await commands.appMutualGraphSnapshotGet(userId.trim());
    const extras = await commands.appMutualGraphExtrasGet(userId.trim());

    const snapshot = new Map<string, string[]>();
    const meta = new Map<string, MutualGraphMeta>();
    const historicalLinks = new Map<string, string>();

    for (const friendId of friendIds) {
        if (friendId && !snapshot.has(friendId)) {
            snapshot.set(friendId, []);
        }
    }

    const trackedUsers = extras.trackedUsers.map((user) => ({
        userId: user.userId,
        displayName: user.displayName,
        addedAt: user.addedAt
    }));
    for (const user of trackedUsers) {
        if (user.userId && !snapshot.has(user.userId)) {
            snapshot.set(user.userId, []);
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
        meta,
        trackedUsers,
        manualLinks: extras.manualLinks.map((link) => ({
            userIdA: link.userIdA,
            userIdB: link.userIdB,
            relationType: link.relationType,
            addedAt: link.addedAt
        }))
    };
}

async function setTrackedUser(
    ownerUserId: string,
    userId: string,
    displayName: string,
    tracked: boolean
) {
    await commands.appMutualGraphTrackedUserSet({
        ownerUserId,
        userId,
        displayName,
        tracked
    });
}

async function setManualLink(
    ownerUserId: string,
    userIdA: string,
    userIdB: string,
    related: boolean
) {
    await commands.appMutualGraphManualLinkSet({
        ownerUserId,
        userIdA,
        userIdB,
        related
    });
}

const mutualGraphPersistenceRepository = Object.freeze({
    getSnapshot,
    setTrackedUser,
    setManualLink
});

export default mutualGraphPersistenceRepository;
