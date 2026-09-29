import { beforeEach, describe, expect, it, vi } from 'vitest';

import trackedNonfriendsRepository from '@/repositories/trackedNonfriendsRepository';
import { useMutualGraphRevisionStore } from '@/state/mutualGraphRevisionStore';

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
const add = vi.mocked(trackedNonfriendsRepository.add);
const remove = vi.mocked(trackedNonfriendsRepository.remove);
const updateName = vi.mocked(trackedNonfriendsRepository.updateName);

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
        useMutualGraphRevisionStore.getState().reset();
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
        expect(list).toHaveBeenNthCalledWith(1, 'usr_owner_a');
        expect(list).toHaveBeenNthCalledWith(2, 'usr_owner_b');
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

    it('does not expose an old account load after switching accounts', async () => {
        let resolveOwnerA:
            | ((entries: ReturnType<typeof trackedEntry>[]) => void)
            | undefined;
        list.mockImplementationOnce(
            () =>
                new Promise<ReturnType<typeof trackedEntry>[]>((resolve) => {
                    resolveOwnerA = resolve;
                })
        ).mockResolvedValueOnce([trackedEntry('usr_b_target')]);

        const ownerALoad = useTrackedNonfriendsStore.getState().load('usr_a');
        await useTrackedNonfriendsStore.getState().load('usr_b');
        resolveOwnerA?.([trackedEntry('usr_a_target')]);
        await ownerALoad;

        expect(useTrackedNonfriendsStore.getState()).toMatchObject({
            currentUserId: 'usr_b',
            entries: [trackedEntry('usr_b_target')]
        });
    });

    it('bump graph revision only after successful add and remove', async () => {
        list.mockResolvedValueOnce([]).mockResolvedValueOnce([
            trackedEntry('usr_target')
        ]);
        add.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
        remove.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
        const store = useTrackedNonfriendsStore.getState();
        await store.load('usr_owner');

        expect(await store.add('usr_owner', 'usr_target', 'Target')).toBe(true);
        expect(add).toHaveBeenCalledWith('usr_owner', {
            userId: 'usr_target',
            displayName: 'Target'
        });
        expect(useMutualGraphRevisionStore.getState()).toMatchObject({
            ownerUserId: 'usr_owner',
            revision: 1
        });
        expect(await store.add('usr_owner', 'usr_target')).toBe(false);
        expect(useMutualGraphRevisionStore.getState().revision).toBe(1);

        expect(await store.remove('usr_owner', 'usr_target')).toBe(true);
        expect(remove).toHaveBeenCalledWith('usr_owner', 'usr_target');
        expect(useMutualGraphRevisionStore.getState().revision).toBe(2);
        expect(await store.remove('usr_owner', 'usr_target')).toBe(false);
        expect(useMutualGraphRevisionStore.getState().revision).toBe(2);
    });

    it('keeps a completed old-owner mutation out of the new account state', async () => {
        let resolveAdd: ((added: boolean) => void) | undefined;
        list.mockResolvedValueOnce([]).mockResolvedValueOnce([
            trackedEntry('usr_b_target')
        ]);
        add.mockImplementationOnce(
            () =>
                new Promise<boolean>((resolve) => {
                    resolveAdd = resolve;
                })
        );
        const store = useTrackedNonfriendsStore.getState();
        await store.load('usr_a');
        const pendingAdd = store.add('usr_a', 'usr_a_target');
        await store.load('usr_b');
        resolveAdd?.(true);
        await pendingAdd;

        expect(useTrackedNonfriendsStore.getState()).toMatchObject({
            currentUserId: 'usr_b',
            entries: [trackedEntry('usr_b_target')]
        });
        expect(useMutualGraphRevisionStore.getState()).toMatchObject({
            ownerUserId: 'usr_a',
            revision: 1
        });
        expect(list).toHaveBeenCalledTimes(2);
    });

    it('refreshes graph labels only after a name update is persisted', async () => {
        list.mockResolvedValue([trackedEntry('usr_target')]);
        updateName.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
        const store = useTrackedNonfriendsStore.getState();
        await store.load('usr_owner');

        expect(
            await store.updateName('usr_owner', 'usr_target', 'New name')
        ).toBe(true);
        expect(useMutualGraphRevisionStore.getState().revision).toBe(1);
        expect(
            useTrackedNonfriendsStore.getState().entries[0].displayName
        ).toBe('New name');
        expect(
            await store.updateName('usr_owner', 'usr_target', 'Ignored')
        ).toBe(false);
        expect(useMutualGraphRevisionStore.getState().revision).toBe(1);
    });
});
