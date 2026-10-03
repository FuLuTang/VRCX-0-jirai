import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useFriendRosterStore } from '@/state/friendRosterStore';
import { useTrackedNonfriendsStore } from '@/state/trackedNonfriendsStore';

import type { EnhancedProfileFetchExecutor } from './enhancedProfileFetchExecutor';
const mocks = vi.hoisted(() => ({
    accountId: 'usr_owner',
    generation: 1,
    baseline: null as
        | null
        | ((id: string, source: 'startup' | 'reconnect' | 'periodic') => void),
    runtimeListener: null as null | (() => void),
    getBool: vi.fn(),
    execute: vi.fn(),
    startup: vi.fn()
}));
vi.mock('@/platform/tauri/bindings', () => ({
    commands: { appProfileFeedReconcile: vi.fn() }
}));
vi.mock('@/repositories/configRepository', () => ({
    default: { getBool: mocks.getBool }
}));
vi.mock('./enhancedProfileFetchRequest', () => ({ fetchRawProfile: vi.fn() }));
vi.mock('@/features/workflows/startupOnlineBackfillExecutor', () => ({
    startupOnlineBackfillExecutor: mocks.startup
}));
vi.mock('./enhancedProfileFetchExecutor', () => ({
    createProfileFetchExecutor: () => mocks.execute
}));
vi.mock('@/state/runtimeStore', () => ({
    useRuntimeStore: {
        getState: () => ({
            auth: { currentUserId: mocks.accountId },
            authenticatedSession: {
                session: {
                    authScopeGeneration: mocks.generation,
                    endpoint: 'test'
                }
            }
        }),
        subscribe: (listener: () => void) => {
            mocks.runtimeListener = listener;
            return () => {
                mocks.runtimeListener = null;
            };
        }
    }
}));
vi.mock('./authenticatedRuntimeService', () => ({
    subscribeAuthenticatedRuntimeEnhancedBaseline: (
        listener: typeof mocks.baseline
    ) => {
        mocks.baseline = listener;
        return () => {
            mocks.baseline = null;
        };
    }
}));
import {
    cancelEnhancedInfoFetch,
    getEnhancedInfoFetchSnapshot,
    getEnhancedInfoFetchTargetCounts,
    initializeEnhancedInfoFetch,
    registerEnhancedRelationshipRecommendations,
    runEnhancedInfoFetch
} from './enhancedInfoFetchService';
let disposers: Array<() => void> = [];
beforeEach(() => {
    mocks.accountId = 'usr_owner';
    mocks.generation = 1;
    mocks.getBool.mockReset().mockResolvedValue(true);
    mocks.execute.mockReset().mockResolvedValue({ status: 'completed' });
    mocks.startup.mockReset().mockResolvedValue({ status: 'completed' });
});
afterEach(async () => {
    disposers.forEach((dispose) => dispose());
    disposers = [];
    cancelEnhancedInfoFetch();
    await Promise.resolve();
});
describe('application-owned enhanced fetch', () => {
    it('counts friends and explicitly tracked non-friends separately, deduplicating overlap', () => {
        useFriendRosterStore.setState({
            currentUserId: 'usr_owner',
            friendsById: {
                usr_friend: { id: 'usr_friend' } as never,
                duplicate: { id: 'usr_friend' } as never
            }
        });
        useTrackedNonfriendsStore.setState({
            currentUserId: 'usr_owner',
            entries: [
                { userId: 'usr_friend', displayName: 'friend' } as never,
                { userId: 'usr_tracked', displayName: 'tracked' } as never,
                { userId: 'usr_tracked', displayName: 'duplicate' } as never
            ]
        });
        expect(getEnhancedInfoFetchTargetCounts('usr_owner')).toEqual({
            friendsTotal: 1,
            trackedTotal: 1
        });
        expect(getEnhancedInfoFetchTargetCounts('usr_other')).toEqual({
            friendsTotal: 0,
            trackedTotal: 0
        });
        useFriendRosterStore.setState({ currentUserId: null, friendsById: {} });
        useTrackedNonfriendsStore.setState({
            currentUserId: null,
            entries: []
        });
    });
    it('does not pretend relationships ran when no engine is registered', async () => {
        await runEnhancedInfoFetch('periodic');
        expect(getEnhancedInfoFetchSnapshot()).toMatchObject({
            relationshipStatus: 'unavailable',
            phase: 'completed'
        });
    });
    it('does not read config on bootstrap; reads it only for a completed baseline', async () => {
        disposers.push(initializeEnhancedInfoFetch());
        expect(mocks.getBool).not.toHaveBeenCalled();
        mocks.baseline?.('usr_owner', 'periodic');
        await vi.waitFor(() => expect(mocks.execute).toHaveBeenCalledTimes(1));
        expect(getEnhancedInfoFetchSnapshot().source).toBe('periodic');
    });
    it('contains configuration failures and honors disabled automatic collection', async () => {
        disposers.push(initializeEnhancedInfoFetch());
        mocks.getBool
            .mockResolvedValueOnce(false)
            .mockRejectedValueOnce(new Error('not initialized'));
        const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
        mocks.baseline?.('usr_owner', 'startup');
        await Promise.resolve();
        mocks.baseline?.('usr_owner', 'periodic');
        await vi.waitFor(() => expect(warning).toHaveBeenCalled());
        expect(mocks.execute).not.toHaveBeenCalled();
        warning.mockRestore();
    });
    it('merges an active sweep but strong-refreshes again after completion', async () => {
        let finish!: (value: { status: string }) => void;
        mocks.execute.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    finish = resolve;
                })
        );
        const first = runEnhancedInfoFetch();
        expect(runEnhancedInfoFetch('periodic')).toBe(first);
        finish({ status: 'completed' });
        await first;
        await runEnhancedInfoFetch();
        expect(mocks.execute).toHaveBeenCalledTimes(2);
    });
    it('cancels on scope replacement even for the same account, and discards late recommendations', async () => {
        disposers.push(initializeEnhancedInfoFetch());
        let finish!: (value: { status: string }) => void;
        let signal!: AbortSignal;
        mocks.execute.mockImplementationOnce(
            (context: Parameters<EnhancedProfileFetchExecutor>[0]) => {
                signal = context.signal;
                return new Promise((resolve) => {
                    finish = resolve;
                });
            }
        );
        const recommendations = vi.fn();
        disposers.push(
            registerEnhancedRelationshipRecommendations(recommendations)
        );
        const task = runEnhancedInfoFetch();
        mocks.generation += 1;
        mocks.runtimeListener?.();
        expect(signal.aborted).toBe(true);
        finish({ status: 'completed' });
        await task;
        expect(recommendations).toHaveBeenCalledTimes(1);
        expect(recommendations.mock.calls[0][0].signal.aborted).toBe(true);
        expect(getEnhancedInfoFetchSnapshot()).toMatchObject({
            phase: 'cancelled',
            running: false
        });
    });
    it('runs relationship calculation while profile collection is still pending', async () => {
        const order: string[] = [];
        let finish!: (value: { status: string }) => void;
        mocks.execute.mockImplementationOnce(() => {
            order.push('profiles');
            return new Promise((resolve) => {
                finish = resolve;
            });
        });
        disposers.push(
            registerEnhancedRelationshipRecommendations(async () => {
                order.push('relationships');
            })
        );
        const run = runEnhancedInfoFetch();
        expect(order).toEqual(['profiles', 'relationships']);
        expect(getEnhancedInfoFetchSnapshot().running).toBe(true);
        finish({ status: 'completed' });
        await run;
        expect(getEnhancedInfoFetchSnapshot().phase).toBe('completed');
        expect(getEnhancedInfoFetchSnapshot().relationshipStatus).toBe(
            'completed'
        );
    });
    it('periodic and button refresh do not execute startup backfill', async () => {
        await runEnhancedInfoFetch('periodic');
        await runEnhancedInfoFetch();
        expect(mocks.startup).not.toHaveBeenCalled();
        expect(mocks.execute).toHaveBeenCalledTimes(2);
    });
    it('a transport reconnect does not schedule another automatic sweep', async () => {
        disposers.push(initializeEnhancedInfoFetch());
        mocks.baseline?.('usr_owner', 'reconnect');
        await Promise.resolve();
        expect(mocks.execute).not.toHaveBeenCalled();
        expect(mocks.getBool).not.toHaveBeenCalled();
    });
    it('keeps profile collection running when relationship calculation fails', async () => {
        let finish!: (value: { status: string }) => void;
        mocks.execute.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    finish = resolve;
                })
        );
        disposers.push(
            registerEnhancedRelationshipRecommendations(async () => {
                throw new Error('local history unavailable');
            })
        );
        const run = runEnhancedInfoFetch();
        await vi.waitFor(() =>
            expect(getEnhancedInfoFetchSnapshot()).toMatchObject({
                running: true,
                relationshipStatus: 'error',
                relationshipError: 'local history unavailable'
            })
        );
        finish({ status: 'completed' });
        await run;
        expect(getEnhancedInfoFetchSnapshot()).toMatchObject({
            running: false,
            phase: 'error',
            collectionStatus: 'completed'
        });
    });
    it('keeps completed collection intact when cancellation stops only the remaining recommendation task', async () => {
        let finish!: () => void;
        disposers.push(
            registerEnhancedRelationshipRecommendations(
                () =>
                    new Promise<void>((resolve) => {
                        finish = resolve;
                    })
            )
        );
        const run = runEnhancedInfoFetch();
        await vi.waitFor(() =>
            expect(getEnhancedInfoFetchSnapshot().collectionStatus).toBe(
                'completed'
            )
        );
        cancelEnhancedInfoFetch();
        expect(getEnhancedInfoFetchSnapshot().collectionStatus).toBe(
            'completed'
        );
        finish();
        await run;
        expect(getEnhancedInfoFetchSnapshot()).toMatchObject({
            phase: 'cancelled',
            collectionStatus: 'completed',
            running: false
        });
    });
    it('reports collection failure without stopping an in-flight recommendation task', async () => {
        let finish!: () => void;
        mocks.execute.mockRejectedValueOnce(
            new Error('profile storage unavailable')
        );
        disposers.push(
            registerEnhancedRelationshipRecommendations(
                () =>
                    new Promise<void>((resolve) => {
                        finish = resolve;
                    })
            )
        );
        const run = runEnhancedInfoFetch();
        await vi.waitFor(() =>
            expect(getEnhancedInfoFetchSnapshot()).toMatchObject({
                running: true,
                collectionStatus: 'error',
                relationshipStatus: 'running'
            })
        );
        finish();
        await run;
        expect(getEnhancedInfoFetchSnapshot()).toMatchObject({
            phase: 'error',
            collectionStatus: 'error',
            relationshipStatus: 'completed',
            running: false
        });
    });
});
