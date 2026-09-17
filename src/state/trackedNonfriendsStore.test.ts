import { beforeEach, describe, expect, it, vi } from 'vitest';

import trackedNonfriendsRepository from '@/repositories/trackedNonfriendsRepository';

import { useTrackedNonfriendsStore } from './trackedNonfriendsStore';

vi.mock('@/repositories/trackedNonfriendsRepository', () => ({
    default: {
        list: vi.fn(),
        add: vi.fn(),
        remove: vi.fn(),
        isTracked: vi.fn(),
        updateName: vi.fn()
    }
}));

const list = vi.mocked(trackedNonfriendsRepository.list);

function trackedEntry(userId: string) {
    return {
        userId,
        displayName: userId,
        addedAt: '2026-01-01T00:00:00Z'
    };
}

describe('tracked nonfriends store ownership', () => {
    beforeEach(() => {
        useTrackedNonfriendsStore.getState().reset();
        vi.resetAllMocks();
    });

    it('clears previous owner entries before loading another account', async () => {
        let resolveOwnerB:
            | ((entries: ReturnType<typeof trackedEntry>[]) => void)
            | undefined;
        list.mockResolvedValueOnce([
            trackedEntry('usr_owner_a_target')
        ]).mockImplementationOnce(
            () =>
                new Promise<ReturnType<typeof trackedEntry>[]>((resolve) => {
                    resolveOwnerB = resolve;
                })
        );

        await useTrackedNonfriendsStore.getState().load('usr_owner_a');
        const ownerBLoad = useTrackedNonfriendsStore
            .getState()
            .load('usr_owner_b');

        expect(useTrackedNonfriendsStore.getState()).toMatchObject({
            currentUserId: 'usr_owner_b',
            entries: [],
            loadStatus: 'loading',
            error: null
        });

        resolveOwnerB?.([trackedEntry('usr_owner_b_target')]);
        await ownerBLoad;
        expect(useTrackedNonfriendsStore.getState()).toMatchObject({
            currentUserId: 'usr_owner_b',
            entries: [trackedEntry('usr_owner_b_target')],
            loadStatus: 'ready'
        });
    });

    it('resets all owner data when no account is available', async () => {
        list.mockResolvedValue([trackedEntry('usr_owner_a_target')]);
        await useTrackedNonfriendsStore.getState().load('usr_owner_a');

        await useTrackedNonfriendsStore.getState().load('');

        expect(useTrackedNonfriendsStore.getState()).toMatchObject({
            currentUserId: null,
            entries: [],
            loadStatus: 'idle',
            error: null
        });
    });
});
