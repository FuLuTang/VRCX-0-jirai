import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
    runtime: {
        auth: { currentUserId: 'me' },
        authenticatedSession: { session: { authScopeGeneration: 1 } }
    },
    roster: {
        currentUserId: 'me',
        loadStatus: 'ready',
        friendsById: { a: { displayName: 'A' }, b: { displayName: 'B' } }
    },
    game: vi.fn(),
    feed: vi.fn(),
    graph: vi.fn(),
    rawGraph: vi.fn()
}));
vi.mock('@/platform/tauri/bindings', () => ({
    commands: {
        appGameLogQuery: mocks.game,
        appMutualGraphSnapshotGet: mocks.rawGraph
    }
}));
vi.mock('@/repositories/feedRepository', () => ({
    default: { queryRelationshipTimelineHistory: mocks.feed }
}));
vi.mock('@/repositories/mutualGraphPersistenceRepository', () => ({
    default: { getSnapshot: mocks.graph }
}));
vi.mock('@/state/runtimeStore', () => ({
    useRuntimeStore: { getState: () => mocks.runtime }
}));
vi.mock('@/state/friendRosterStore', () => ({
    useFriendRosterStore: { getState: () => mocks.roster }
}));
import { loadRecommendationInput } from './relationshipRecommendationData';

beforeEach(() => {
    vi.clearAllMocks();
    mocks.runtime.auth.currentUserId = 'me';
    mocks.runtime.authenticatedSession.session.authScopeGeneration = 1;
    mocks.roster.currentUserId = 'me';
    mocks.roster.loadStatus = 'ready';
    mocks.game.mockResolvedValue({
        kind: 'lookupRows',
        value: [
            {
                rowId: 2,
                type: 'OnPlayerLeft',
                userId: 'b',
                location: 'wrld_x:1',
                created_at: '2026-01-01T00:02:00Z',
                time: 60_000
            },
            {
                rowId: 1,
                type: 'OnPlayerLeft',
                userId: 'a',
                location: 'wrld_x:1',
                created_at: '2026-01-01T00:02:00Z',
                time: 60_000
            },
            {
                rowId: 3,
                type: 'OnPlayerLeft',
                userId: 'me',
                location: 'wrld_x:1',
                created_at: '2026-01-01T00:02:00Z',
                time: 60_000
            }
        ]
    });
    mocks.feed.mockResolvedValue([
        {
            rowId: 2,
            type: 'Offline',
            userId: 'b',
            location: 'wrld_x:1',
            created_at: '2026-01-01T00:02:00Z',
            time: 60_000
        },
        {
            rowId: 1,
            type: 'GPS',
            userId: 'a',
            previousLocation: 'wrld_x:1',
            location: 'wrld_y:2',
            created_at: '2026-01-01T00:02:00Z',
            time: 60_000
        }
    ]);
    mocks.graph.mockResolvedValue({
        trackedUsers: [{ userId: 't', displayName: 'Tracked' }],
        manualLinks: [{ userIdA: 'a', userIdB: 't' }],
        historicalLinks: new Map([['a__x', 'date']])
    });
    mocks.rawGraph.mockResolvedValue({
        historicalLinks: [{ friendId: 'a', mutualId: 'x' }]
    });
});
describe('legacy local recommendation input adaptation', () => {
    it('preserves UNION ALL and game/GPS/Offline order, with GPS previous location', async () => {
        const result = await loadRecommendationInput(
            'me',
            new AbortController().signal
        );
        expect(
            result.eventsByLocation.get('wrld_x:1')?.map((row) => row.userId)
        ).toEqual(['a', 'b', 'a', 'b']);
        expect(result.eventsByLocation.has('wrld_y:2')).toBe(false);
        expect(result.mySessions.get('wrld_x:1')).toHaveLength(1);
        expect(result.oldMutualSnapshot.get('a')).toEqual(new Set(['x']));
        expect(result.oldMutualSnapshot.has('x')).toBe(false);
        expect(result.trackedIds).toEqual(['t']);
        expect(result.manualLinks).toEqual([{ userIdA: 'a', userIdB: 't' }]);
        expect(mocks.feed).toHaveBeenCalledWith('me');
    });
    it('rejects stale owner roster before querying', async () => {
        mocks.roster.currentUserId = 'other';
        await expect(
            loadRecommendationInput('me', new AbortController().signal)
        ).rejects.toMatchObject({ name: 'AbortError' });
        expect(mocks.game).not.toHaveBeenCalled();
    });
    it('discards a same-account generation change during local reads', async () => {
        mocks.rawGraph.mockImplementation(async () => {
            mocks.runtime.authenticatedSession.session.authScopeGeneration = 2;
            return { historicalLinks: [] };
        });
        await expect(
            loadRecommendationInput('me', new AbortController().signal)
        ).rejects.toMatchObject({ name: 'AbortError' });
    });
});
