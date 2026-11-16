import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    appTrackedNonfriendsList: vi.fn(),
    appTrackedNonfriendsAdd: vi.fn(),
    appTrackedNonfriendsRemove: vi.fn(),
    appTrackedNonfriendsIsTracked: vi.fn(),
    appTrackedNonfriendsUpdateName: vi.fn()
}));

vi.mock('@/platform/tauri/bindings', () => ({ commands: mocks }));

import trackedNonfriendsRepository from './trackedNonfriendsRepository';

describe('trackedNonfriendsRepository', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.appTrackedNonfriendsList.mockResolvedValue([]);
        mocks.appTrackedNonfriendsAdd.mockResolvedValue(true);
        mocks.appTrackedNonfriendsRemove.mockResolvedValue(true);
        mocks.appTrackedNonfriendsIsTracked.mockResolvedValue(true);
        mocks.appTrackedNonfriendsUpdateName.mockResolvedValue(true);
    });

    it('passes the expected owner to every native read and mutation', async () => {
        await trackedNonfriendsRepository.list(' usr_owner ');
        await trackedNonfriendsRepository.add(' usr_owner ', {
            userId: ' usr_target ',
            displayName: ' Target '
        });
        await trackedNonfriendsRepository.remove(' usr_owner ', ' usr_target ');
        await trackedNonfriendsRepository.isTracked(
            ' usr_owner ',
            ' usr_target '
        );
        await trackedNonfriendsRepository.updateName(' usr_owner ', {
            userId: ' usr_target ',
            displayName: ' Renamed '
        });

        expect(mocks.appTrackedNonfriendsList).toHaveBeenCalledWith(
            'usr_owner'
        );
        expect(mocks.appTrackedNonfriendsAdd).toHaveBeenCalledWith(
            'usr_owner',
            { userId: 'usr_target', displayName: 'Target' }
        );
        expect(mocks.appTrackedNonfriendsRemove).toHaveBeenCalledWith(
            'usr_owner',
            'usr_target'
        );
        expect(mocks.appTrackedNonfriendsIsTracked).toHaveBeenCalledWith(
            'usr_owner',
            'usr_target'
        );
        expect(mocks.appTrackedNonfriendsUpdateName).toHaveBeenCalledWith(
            'usr_owner',
            { userId: 'usr_target', displayName: 'Renamed' }
        );
    });

    it('rejects a missing expected owner before invoking native commands', async () => {
        await expect(trackedNonfriendsRepository.list(' ')).rejects.toThrow(
            'requires an account'
        );
        await expect(
            trackedNonfriendsRepository.add('', { userId: 'usr_target' })
        ).rejects.toThrow('requires an account');
        expect(mocks.appTrackedNonfriendsList).not.toHaveBeenCalled();
        expect(mocks.appTrackedNonfriendsAdd).not.toHaveBeenCalled();
    });
});
