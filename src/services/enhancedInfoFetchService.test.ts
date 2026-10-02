import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EnhancedProfileFetchExecutor } from './enhancedProfileFetchExecutor';
const mocks = vi.hoisted(() => ({
    accountId: 'usr_owner',
    generation: 1,
    baseline: null as
        | null
        | ((id: string, source: 'startup' | 'reconnect' | 'periodic') => void),
    runtimeListener: null as null | (() => void),
    getBool: vi.fn(),
    execute: vi.fn()
}));
vi.mock('@/platform/tauri/bindings', () => ({
    commands: { appProfileFeedReconcile: vi.fn() }
}));
vi.mock('@/repositories/configRepository', () => ({
    default: { getBool: mocks.getBool }
}));
vi.mock('./enhancedProfileFetchRequest', () => ({ fetchRawProfile: vi.fn() }));
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
});
afterEach(async () => {
    disposers.forEach((dispose) => dispose());
    disposers = [];
    cancelEnhancedInfoFetch();
    await Promise.resolve();
});
describe('application-owned enhanced fetch', () => {
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
        expect(runEnhancedInfoFetch('reconnect')).toBe(first);
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
        expect(recommendations).not.toHaveBeenCalled();
        expect(getEnhancedInfoFetchSnapshot()).toMatchObject({
            phase: 'cancelled',
            running: false
        });
    });
    it('keeps collection alive without a UI subscription and computes relationships after profiles', async () => {
        const order: string[] = [];
        mocks.execute.mockImplementationOnce(async () => {
            order.push('profiles');
            return { status: 'completed' };
        });
        disposers.push(
            registerEnhancedRelationshipRecommendations(async () => {
                order.push('relationships');
            })
        );
        await runEnhancedInfoFetch();
        expect(order).toEqual(['profiles', 'relationships']);
        expect(getEnhancedInfoFetchSnapshot().phase).toBe('completed');
    });
});
