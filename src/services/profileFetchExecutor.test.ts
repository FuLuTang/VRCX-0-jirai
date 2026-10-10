import { describe, expect, it, vi } from 'vitest';

import { createProfileFetchExecutor } from './profileFetchExecutor';

const context = (signal = new AbortController().signal) => ({
    accountId: 'usr_owner',
    signal,
    translate: (key: string) => key
});

describe('profileFetchExecutor', () => {
    it('deduplicates friends and tracked targets, retries once, and continues', async () => {
        const getUserProfile = vi
            .fn()
            .mockRejectedValueOnce(new Error('temporary'))
            .mockResolvedValueOnce({
                displayName: 'Friend',
                bio: '',
                status: 'active',
                statusDescription: ''
            })
            .mockResolvedValueOnce({
                displayName: 'Tracked',
                bio: '',
                status: '',
                statusDescription: ''
            });
        const reconcile = vi
            .fn()
            .mockResolvedValue({ bioUpdated: false, statusUpdated: false });
        const wait = vi.fn().mockResolvedValue(undefined);
        const run = createProfileFetchExecutor({
            getFriends: () => ({
                usr_a: { id: 'usr_a', displayName: 'Friend' }
            }),
            loadTracked: vi.fn().mockResolvedValue(undefined),
            getTracked: () => ({
                currentUserId: 'usr_owner',
                entries: [
                    { userId: 'usr_a', displayName: 'Duplicate' },
                    { userId: 'usr_b', displayName: 'Tracked' }
                ]
            }),
            getUserProfile,
            reconcile,
            wait
        });
        const outcome = await run(context());
        expect(getUserProfile).toHaveBeenCalledTimes(3);
        expect(reconcile).toHaveBeenCalledTimes(2);
        expect(wait).toHaveBeenCalledWith(500, expect.any(AbortSignal));
        expect(outcome).toMatchObject({
            status: 'completed',
            result: { targets: 2, failed: 0 }
        });
    });

    it('does not issue subsequent requests after abort', async () => {
        const controller = new AbortController();
        const getUserProfile = vi.fn().mockImplementation(async () => {
            controller.abort();
            return {
                displayName: 'A',
                bio: '',
                status: '',
                statusDescription: ''
            };
        });
        const reconcile = vi.fn();
        const run = createProfileFetchExecutor({
            getFriends: () => ({ a: { id: 'usr_a' }, b: { id: 'usr_b' } }),
            loadTracked: vi.fn().mockResolvedValue(undefined),
            getTracked: () => ({ currentUserId: 'usr_owner', entries: [] }),
            getUserProfile,
            reconcile,
            wait: vi.fn().mockResolvedValue(undefined)
        });
        await expect(run(context(controller.signal))).rejects.toMatchObject({
            name: 'AbortError'
        });
        expect(getUserProfile).toHaveBeenCalledTimes(1);
        expect(reconcile).not.toHaveBeenCalled();
    });

    it('loads tracked entries before targets and ignores another account cache', async () => {
        let tracked = {
            currentUserId: 'usr_old',
            entries: [{ userId: 'usr_old_target', displayName: 'Old' }]
        };
        const getUserProfile = vi.fn().mockResolvedValue({
            displayName: 'Tracked',
            bio: '',
            status: '',
            statusDescription: ''
        });
        const run = createProfileFetchExecutor({
            getFriends: () => ({}),
            loadTracked: async (accountId) => {
                tracked = {
                    currentUserId: accountId,
                    entries: [{ userId: 'usr_tracked', displayName: 'Tracked' }]
                };
            },
            getTracked: () => tracked,
            getUserProfile,
            reconcile: vi
                .fn()
                .mockResolvedValue({ bioUpdated: false, statusUpdated: false }),
            wait: vi.fn().mockResolvedValue(undefined)
        });
        await run(context());
        expect(getUserProfile).toHaveBeenCalledWith(
            expect.objectContaining({ userId: 'usr_tracked' })
        );
        expect(getUserProfile).not.toHaveBeenCalledWith(
            expect.objectContaining({ userId: 'usr_old_target' })
        );
    });
});
