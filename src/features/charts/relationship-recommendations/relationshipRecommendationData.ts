import { commands } from '@/platform/tauri/bindings';
import feedRepository from '@/repositories/feedRepository';
import mutualGraphPersistenceRepository from '@/repositories/mutualGraphPersistenceRepository';
import { useFriendRosterStore } from '@/state/friendRosterStore';
import { useRuntimeStore } from '@/state/runtimeStore';

import type {
    CandidateSession,
    RecommendationInput
} from '../relationshipRecommendationsAlgorithm';

export async function loadRecommendationInput(
    accountId: string,
    signal: AbortSignal
): Promise<RecommendationInput> {
    const generation =
        useRuntimeStore.getState().authenticatedSession.session
            ?.authScopeGeneration;
    const assertCurrent = () => {
        signal.throwIfAborted();
        const runtime = useRuntimeStore.getState();
        const roster = useFriendRosterStore.getState();
        if (
            generation == null ||
            runtime.auth.currentUserId !== accountId ||
            runtime.authenticatedSession.session?.authScopeGeneration !==
                generation ||
            roster.currentUserId !== accountId ||
            roster.loadStatus !== 'ready'
        )
            throw new DOMException('Account changed', 'AbortError');
    };
    assertCurrent();
    const friendRows = Object.entries(
        useFriendRosterStore.getState().friendsById
    );
    const [feed, graph, game, rawGraph] = await Promise.all([
        feedRepository.queryRelationshipTimelineHistory(accountId),
        mutualGraphPersistenceRepository.getSnapshot(accountId),
        commands.appGameLogQuery({
            kind: 'lookupRows',
            params: {
                filters: ['OnPlayerLeft'],
                maxEntries: Number.MAX_SAFE_INTEGER,
                maxRows: Number.MAX_SAFE_INTEGER
            }
        }),
        commands.appMutualGraphSnapshotGet(accountId)
    ]);
    assertCurrent();
    const eventsByLocation = new Map<string, CandidateSession[]>();
    const mySessions = new Map<string, { leaveAt: number; time: number }[]>();
    const names = new Map(
        friendRows.map(([id, friend]) => [id, friend.displayName || id])
    );
    for (const user of graph.trackedUsers)
        names.set(user.userId, user.displayName || user.userId);
    const append = (location: string, session: CandidateSession) => {
        if (session.userId === accountId) {
            const rows = mySessions.get(location) || [];
            rows.push(session);
            mySessions.set(location, rows);
        } else {
            const rows = eventsByLocation.get(location) || [];
            rows.push(session);
            eventsByLocation.set(location, rows);
        }
    };
    const excluded = new Set([
        '',
        'offline',
        'traveling',
        'private',
        'private:private'
    ]);
    if (game.kind !== 'lookupRows')
        throw new Error('Unexpected game log query result');
    // Reproduce the legacy UNION ALL source/row order; the first overlapping
    // session affects the snapshot evidence heuristic. Do not deduplicate.
    for (const row of [...game.value].sort((a, b) => a.rowId - b.rowId)) {
        assertCurrent();
        const location = row.location || '';
        const leaveAt = Date.parse(row.created_at);
        if (
            row.type !== 'OnPlayerLeft' ||
            !row.userId ||
            !(row.time && row.time > 0) ||
            !Number.isFinite(leaveAt)
        )
            continue;
        if (
            row.userId === accountId
                ? ['', 'traveling'].includes(location)
                : excluded.has(location)
        )
            continue;
        names.set(
            row.userId,
            names.get(row.userId) || row.displayName || row.userId
        );
        append(location, { userId: row.userId, leaveAt, time: row.time });
    }
    for (const row of [...feed].sort(
        (a, b) =>
            (a.type === 'GPS' ? 0 : 1) - (b.type === 'GPS' ? 0 : 1) ||
            (a.rowId || 0) - (b.rowId || 0)
    )) {
        assertCurrent();
        const location =
            (row.type === 'GPS' ? row.previousLocation : row.location) || '';
        const leaveAt = Date.parse(row.created_at || '');
        if (
            !row.userId ||
            row.userId === accountId ||
            excluded.has(location) ||
            !(row.time && row.time > 0) ||
            !Number.isFinite(leaveAt)
        )
            continue;
        append(location, { userId: row.userId, leaveAt, time: row.time });
    }
    const oldMutualSnapshot = new Map<string, Set<string>>();
    // Keep the original directed OLD snapshot: symmetrizing changes the
    // legacy "both expose mutuals" exclusion heuristic.
    for (const { friendId, mutualId } of rawGraph.historicalLinks) {
        if (!friendId || !mutualId) continue;
        const ids = oldMutualSnapshot.get(friendId) || new Set<string>();
        ids.add(mutualId);
        oldMutualSnapshot.set(friendId, ids);
    }
    return {
        eventsByLocation,
        mySessions,
        names,
        oldMutualSnapshot,
        friendIds: friendRows.map(([id]) => id),
        trackedIds: graph.trackedUsers.map((row) => row.userId),
        manualLinks: graph.manualLinks,
        signal
    };
}
