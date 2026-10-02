import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useMutualGraphRevisionStore } from '@/state/mutualGraphRevisionStore';
const mocks = vi.hoisted(() => ({
    runtime: {
        auth: { currentUserId: 'owner-a' },
        authenticatedSession: { session: { authScopeGeneration: 1 } }
    },
    publish: vi.fn(async () => {}),
    manual: vi.fn(async () => {}),
    register: vi.fn(() => vi.fn()),
    subscribe: vi.fn(() => vi.fn()),
    load: vi.fn()
}));
vi.mock('@/platform/tauri/bindings', () => ({
    commands: { appRelationshipRecommendationsSet: mocks.publish }
}));
vi.mock('@/repositories/mutualGraphPersistenceRepository', () => ({
    default: { setManualLink: mocks.manual }
}));
vi.mock('@/services/enhancedInfoFetchService', () => ({
    registerEnhancedRelationshipRecommendations: mocks.register
}));
vi.mock('@/state/runtimeStore', () => ({
    useRuntimeStore: {
        getState: () => mocks.runtime,
        subscribe: mocks.subscribe
    }
}));
vi.mock('./relationshipRecommendationData', () => ({
    loadRecommendationInput: mocks.load
}));
import {
    calculateRelationshipRecommendations,
    confirmRelationshipRecommendation,
    getAccountRecommendations,
    ignoreRelationshipRecommendation,
    initializeRelationshipRecommendations,
    useRelationshipRecommendations
} from './relationshipRecommendationsService';

function input() {
    return {
        friendIds: ['a', 'b'],
        trackedIds: [],
        names: new Map(),
        manualLinks: [],
        oldMutualSnapshot: new Map(),
        mySessions: new Map(),
        eventsByLocation: new Map([
            [
                'wrld_x:1',
                [
                    { userId: 'a', leaveAt: 1000000, time: 600000 },
                    { userId: 'b', leaveAt: 1000000, time: 600000 }
                ]
            ]
        ])
    };
}
function calculate(accountId = mocks.runtime.auth.currentUserId) {
    return calculateRelationshipRecommendations({
        accountId,
        signal: new AbortController().signal
    });
}
beforeEach(() => {
    vi.clearAllMocks();
    mocks.runtime.auth.currentUserId = 'owner-a';
    mocks.runtime.authenticatedSession.session.authScopeGeneration = 1;
    useRelationshipRecommendations.setState({ accounts: {} });
    useMutualGraphRevisionStore.getState().reset();
    mocks.load.mockResolvedValue(input());
});
describe('recommendation lifecycle and account isolation', () => {
    it('publishes generation and only local calculated candidates', async () => {
        await calculate();
        expect(mocks.publish).toHaveBeenCalledWith('owner-a', 1, [
            expect.objectContaining({ userIdA: 'a', userIdB: 'b', score: 5 })
        ]);
    });
    it('ignores only in memory per account, including after recalculation', async () => {
        await calculate();
        await ignoreRelationshipRecommendation('owner-a', 'a|b');
        expect(mocks.publish).toHaveBeenLastCalledWith('owner-a', 1, []);
        await calculate();
        expect(mocks.publish).toHaveBeenLastCalledWith('owner-a', 1, []);
        mocks.runtime.auth.currentUserId = 'owner-b';
        mocks.runtime.authenticatedSession.session.authScopeGeneration = 2;
        await calculate();
        expect(getAccountRecommendations('owner-b')?.ignored.size).toBe(0);
        expect(mocks.publish).toHaveBeenLastCalledWith(
            'owner-b',
            2,
            expect.any(Array)
        );
        expect(mocks.manual).not.toHaveBeenCalled();
    });
    it('confirms the existing account-scoped manual relation table and removes overlay candidate', async () => {
        await calculate();
        const row = getAccountRecommendations('owner-a')!.suggestions[0];
        await confirmRelationshipRecommendation('owner-a', row);
        expect(mocks.manual).toHaveBeenCalledWith('owner-a', 'a', 'b', true);
        expect(mocks.manual).toHaveBeenCalledOnce();
        expect(useMutualGraphRevisionStore.getState()).toMatchObject({
            ownerUserId: 'owner-a',
            revision: 1
        });
        expect(
            getAccountRecommendations('owner-a')!.suggestions[0].isAdded
        ).toBe(true);
        expect(mocks.publish).toHaveBeenLastCalledWith('owner-a', 1, []);
    });
    it('discards results after account or same-owner generation change', async () => {
        mocks.load.mockImplementation(async () => {
            mocks.runtime.authenticatedSession.session.authScopeGeneration = 2;
            return input();
        });
        await expect(calculate()).rejects.toMatchObject({ name: 'AbortError' });
        expect(mocks.publish).not.toHaveBeenCalled();
        expect(getAccountRecommendations('owner-a')?.suggestions).toEqual([]);
    });
    it('does not confirm or ignore another active account', async () => {
        await calculate();
        mocks.runtime.auth.currentUserId = 'owner-b';
        await confirmRelationshipRecommendation(
            'owner-a',
            getAccountRecommendations('owner-a')!.suggestions[0]
        );
        await ignoreRelationshipRecommendation('owner-a', 'a|b');
        expect(mocks.manual).not.toHaveBeenCalled();
        expect(getAccountRecommendations('owner-a')?.ignored.size).toBe(0);
    });
    it('registers enhanced local executor and unregisters on disposal', () => {
        const unregister = vi.fn();
        mocks.register.mockReturnValue(unregister);
        const dispose = initializeRelationshipRecommendations();
        expect(mocks.register).toHaveBeenCalledWith(
            calculateRelationshipRecommendations
        );
        dispose();
        expect(unregister).toHaveBeenCalledOnce();
    });
});
