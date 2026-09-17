import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    appManualRelationAdd: vi.fn(),
    appManualRelationRemove: vi.fn(),
    appManualRelationsForUser: vi.fn(),
    appManualRelationsList: vi.fn()
}));

vi.mock('@/platform/tauri/bindings', () => ({
    commands: mocks
}));

import manualRelationsRepository from './manualRelationsRepository';

describe('manualRelationsRepository', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.appManualRelationsList.mockResolvedValue([]);
        mocks.appManualRelationsForUser.mockResolvedValue([]);
        mocks.appManualRelationAdd.mockResolvedValue(undefined);
        mocks.appManualRelationRemove.mockResolvedValue(undefined);
    });

    it('never sends an owner identifier to native commands', async () => {
        await manualRelationsRepository.list();
        await manualRelationsRepository.listForUser(' usr_a ');
        await manualRelationsRepository.add({
            userIdA: 'usr_b',
            userIdB: 'usr_a'
        });
        await manualRelationsRepository.remove({
            userIdA: 'usr_b',
            userIdB: 'usr_a'
        });

        expect(mocks.appManualRelationsList).toHaveBeenCalledWith();
        expect(mocks.appManualRelationsForUser).toHaveBeenCalledWith('usr_a');
        expect(mocks.appManualRelationAdd).toHaveBeenCalledWith(
            'usr_a',
            'usr_b',
            'friend'
        );
        expect(mocks.appManualRelationRemove).toHaveBeenCalledWith(
            'usr_a',
            'usr_b'
        );
    });
});
