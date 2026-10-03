import { describe, expect, it, vi } from 'vitest';

import { createRequestError } from '@/repositories/vrchatRequest';

vi.mock('@/platform/tauri/bindings', () => ({
    commands: { appProfileFeedReconcile: vi.fn() }
}));

import { createProfileFetchExecutor } from './profileFetchExecutor';

const context = (signal = new AbortController().signal) => ({
    accountId: 'usr_owner',
    signal,
    translate: (key: string) => key
});

describe('profileFetchExecutor', () => {
    it('counts an already saved status once across a public Bio retry', async () => {
        const getUserProfile = vi
            .fn()
            .mockRejectedValueOnce(
                Object.assign(createRequestError('limited', 429, 'profile/a'), {
                    $jiraiStatusUpdated: true
                })
            )
            .mockResolvedValue({
                bio: 'bio',
                status: 'active',
                statusDescription: ''
            });
        const run = createProfileFetchExecutor({
            getFriends: () => ({ usr_a: { id: 'usr_a' } }),
            isAccountCurrent: () => true,
            loadTracked: vi.fn().mockResolvedValue(undefined),
            getTracked: () => ({ currentUserId: 'usr_owner', entries: [] }),
            getUserProfile,
            wait: vi.fn().mockResolvedValue(undefined),
            reconcile: vi
                .fn()
                .mockResolvedValue({ bioUpdated: false, statusUpdated: false })
        });
        expect(await run(context())).toMatchObject({
            result: { statusUpdated: 1, unchanged: 0, failed: 0, succeeded: 1 }
        });
    });
    it('publishes real progress and pauses the queue on 429 before bounded retry', async () => {
        const getUserProfile = vi
            .fn()
            .mockRejectedValueOnce(
                Object.assign(
                    createRequestError('limited', 429, 'users/usr_a'),
                    { retryAfter: '7' }
                )
            )
            .mockResolvedValueOnce({
                bio: 'a',
                status: 'active',
                statusDescription: ''
            })
            .mockResolvedValueOnce({ status: 'active' });
        const wait = vi.fn().mockResolvedValue(undefined);
        const onProfileProgress = vi.fn();
        const run = createProfileFetchExecutor({
            getFriends: () => ({
                usr_a: { id: 'usr_a' },
                usr_b: { id: 'usr_b' }
            }),
            isAccountCurrent: () => true,
            loadTracked: vi.fn().mockResolvedValue(undefined),
            getTracked: () => ({ currentUserId: 'usr_owner', entries: [] }),
            getUserProfile,
            wait,
            reconcile: vi
                .fn()
                .mockResolvedValue({ bioUpdated: false, statusUpdated: false })
        });
        const outcome = await run({ ...context(), onProfileProgress });
        expect(wait).toHaveBeenCalledWith(7000, expect.any(AbortSignal));
        expect(onProfileProgress).toHaveBeenCalledWith(
            expect.objectContaining({ pauseReason: 'HTTP 429', processed: 0 })
        );
        expect(outcome).toMatchObject({
            result: { processed: 2, succeeded: 2, unchanged: 1, incomplete: 1 }
        });
    });
    it('uses the nonfriend profile from the same workflow round without fetching again', async () => {
        const getUserProfile = vi.fn();
        const run = createProfileFetchExecutor({
            getFriends: () => ({}),
            isAccountCurrent: () => true,
            loadTracked: vi.fn().mockResolvedValue(undefined),
            getTracked: () => ({
                currentUserId: 'usr_owner',
                entries: [{ userId: 'usr_tracked', displayName: 'Tracked' }]
            }),
            getUserProfile,
            wait: vi.fn(),
            reconcile: vi
                .fn()
                .mockResolvedValue({ bioUpdated: true, statusUpdated: false })
        });
        const profiles = new Map([
            ['usr_tracked', { id: 'usr_tracked', bio: 'observed' }]
        ]);
        expect(await run({ ...context(), profiles })).toMatchObject({
            result: { bioUpdated: 1, succeeded: 1 }
        });
        expect(getUserProfile).not.toHaveBeenCalled();
    });
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
            isAccountCurrent: () => true,
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
        expect(wait).toHaveBeenCalledWith(3_000, expect.any(AbortSignal));
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
            isAccountCurrent: () => true,
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
            isAccountCurrent: () => true,
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

    it('omits an absent Bio instead of writing an empty Bio event', async () => {
        const reconcile = vi
            .fn()
            .mockResolvedValue({ bioUpdated: false, statusUpdated: true });
        const run = createProfileFetchExecutor({
            getFriends: () => ({ usr_a: { id: 'usr_a' } }),
            isAccountCurrent: () => true,
            loadTracked: vi.fn().mockResolvedValue(undefined),
            getTracked: () => ({ currentUserId: 'usr_owner', entries: [] }),
            getUserProfile: vi
                .fn()
                .mockResolvedValue({ status: 'active', statusDescription: '' }),
            reconcile,
            wait: vi.fn().mockResolvedValue(undefined)
        });
        await run(context());
        expect(reconcile).toHaveBeenCalledWith({
            expectedOwnerUserId: 'usr_owner',
            userId: 'usr_a',
            displayName: 'usr_a',
            status: 'active',
            statusDescription: ''
        });
        expect(reconcile.mock.calls[0][0]).not.toHaveProperty('bio');
    });

    it('keeps an explicitly empty Bio and omits incomplete status data', async () => {
        const reconcile = vi
            .fn()
            .mockResolvedValue({ bioUpdated: true, statusUpdated: false });
        const run = createProfileFetchExecutor({
            getFriends: () => ({
                usr_a: { id: 'usr_a' },
                usr_b: { id: 'usr_b' }
            }),
            isAccountCurrent: () => true,
            loadTracked: vi.fn().mockResolvedValue(undefined),
            getTracked: () => ({ currentUserId: 'usr_owner', entries: [] }),
            getUserProfile: vi
                .fn()
                .mockResolvedValueOnce({
                    bio: '',
                    status: 'active',
                    statusDescription: ''
                })
                .mockResolvedValueOnce({ bio: 'known', status: 'active' }),
            reconcile,
            wait: vi.fn().mockResolvedValue(undefined)
        });
        const outcome = await run(context());
        expect(reconcile).toHaveBeenCalledTimes(2);
        expect(reconcile.mock.calls[0][0]).toHaveProperty('bio', '');
        expect(reconcile.mock.calls[1][0]).toMatchObject({ bio: 'known' });
        expect(reconcile.mock.calls[1][0]).not.toHaveProperty('status');
        expect(reconcile.mock.calls[1][0]).not.toHaveProperty(
            'statusDescription'
        );
        expect(outcome).toMatchObject({ result: { incomplete: 1 } });
    });

    it('does not reconcile a profile returned after the account changes', async () => {
        let current = true;
        const reconcile = vi.fn();
        const run = createProfileFetchExecutor({
            getFriends: () => ({ usr_a: { id: 'usr_a' } }),
            isAccountCurrent: () => current,
            loadTracked: vi.fn().mockResolvedValue(undefined),
            getTracked: () => ({ currentUserId: 'usr_owner', entries: [] }),
            getUserProfile: vi.fn().mockImplementation(async () => {
                current = false;
                return { bio: 'bio', status: 'active', statusDescription: '' };
            }),
            reconcile,
            wait: vi.fn().mockResolvedValue(undefined)
        });
        await expect(run(context())).resolves.toMatchObject({
            status: 'skipped'
        });
        expect(reconcile).not.toHaveBeenCalled();
    });

    it('records a persistent per-user network failure and continues the sweep', async () => {
        const reconcile = vi.fn();
        const getUserProfile = vi.fn().mockRejectedValue(new Error('offline'));
        const run = createProfileFetchExecutor({
            getFriends: () => ({
                usr_a: { id: 'usr_a' },
                usr_b: { id: 'usr_b' }
            }),
            isAccountCurrent: () => true,
            loadTracked: vi.fn().mockResolvedValue(undefined),
            getTracked: () => ({ currentUserId: 'usr_owner', entries: [] }),
            getUserProfile,
            reconcile,
            wait: vi.fn().mockResolvedValue(undefined)
        });
        await expect(run(context())).resolves.toMatchObject({
            result: { failed: 2, processed: 2, succeeded: 0 }
        });
        expect(getUserProfile).toHaveBeenCalledTimes(4);
        expect(reconcile).not.toHaveBeenCalled();
    });

    it.each([401])('stops immediately on HTTP %i', async (status) => {
        const getUserProfile = vi
            .fn()
            .mockRejectedValue(
                createRequestError('upstream failure', status, 'users/usr_a')
            );
        const reconcile = vi.fn();
        const wait = vi.fn().mockResolvedValue(undefined);
        const run = createProfileFetchExecutor({
            getFriends: () => ({
                usr_a: { id: 'usr_a' },
                usr_b: { id: 'usr_b' }
            }),
            isAccountCurrent: () => true,
            loadTracked: vi.fn().mockResolvedValue(undefined),
            getTracked: () => ({ currentUserId: 'usr_owner', entries: [] }),
            getUserProfile,
            reconcile,
            wait
        });
        await expect(run(context())).rejects.toMatchObject({ status });
        expect(getUserProfile).toHaveBeenCalledOnce();
        expect(reconcile).not.toHaveBeenCalled();
        expect(wait).not.toHaveBeenCalled();
    });

    it('pauses and retries a typed platform rate-limit error within the bounded budget', async () => {
        const getUserProfile = vi.fn().mockRejectedValue(
            Object.assign(new Error('limited'), {
                code: 'vrchat_api',
                statusCode: 429
            })
        );
        const run = createProfileFetchExecutor({
            getFriends: () => ({
                usr_a: { id: 'usr_a' },
                usr_b: { id: 'usr_b' }
            }),
            isAccountCurrent: () => true,
            loadTracked: vi.fn().mockResolvedValue(undefined),
            getTracked: () => ({ currentUserId: 'usr_owner', entries: [] }),
            getUserProfile,
            reconcile: vi.fn(),
            wait: vi.fn().mockResolvedValue(undefined)
        });
        await expect(run(context())).resolves.toMatchObject({
            result: { failed: 2, processed: 2 }
        });
        expect(getUserProfile).toHaveBeenCalledTimes(4);
    });
    it('counts Bio and status already committed by native observers without double counting', async () => {
        const run = createProfileFetchExecutor({
            getFriends: () => ({ usr_a: { id: 'usr_a' } }),
            isAccountCurrent: () => true,
            loadTracked: vi.fn().mockResolvedValue(undefined),
            getTracked: () => ({ currentUserId: 'usr_owner', entries: [] }),
            getUserProfile: vi.fn().mockResolvedValue({
                bio: 'canonical',
                status: 'active',
                statusDescription: '',
                $jiraiBioUpdated: true,
                $jiraiStatusUpdated: true
            }),
            reconcile: vi
                .fn()
                .mockResolvedValue({ bioUpdated: true, statusUpdated: true }),
            wait: vi.fn()
        });
        expect(await run(context())).toMatchObject({
            result: {
                bioUpdated: 1,
                statusUpdated: 1,
                unchanged: 0,
                succeeded: 1
            }
        });
    });
    it('continues to the next user after bounded server failures', async () => {
        const getUserProfile = vi
            .fn()
            .mockRejectedValueOnce(createRequestError('server', 500, 'users/a'))
            .mockRejectedValueOnce(createRequestError('server', 500, 'users/a'))
            .mockResolvedValue({
                bio: '',
                status: 'active',
                statusDescription: ''
            });
        const run = createProfileFetchExecutor({
            getFriends: () => ({
                usr_a: { id: 'usr_a' },
                usr_b: { id: 'usr_b' }
            }),
            isAccountCurrent: () => true,
            loadTracked: vi.fn().mockResolvedValue(undefined),
            getTracked: () => ({ currentUserId: 'usr_owner', entries: [] }),
            getUserProfile,
            reconcile: vi
                .fn()
                .mockResolvedValue({ bioUpdated: false, statusUpdated: false }),
            wait: vi.fn().mockResolvedValue(undefined)
        });
        expect(await run(context())).toMatchObject({
            result: { failed: 1, succeeded: 1, processed: 2 }
        });
        expect(getUserProfile).toHaveBeenCalledTimes(3);
    });

    it('skips an unavailable profile with short sequential pacing', async () => {
        const events: string[] = [];
        const getUserProfile = vi
            .fn()
            .mockImplementation(async ({ userId }: { userId: string }) => {
                events.push(`request:${userId}`);
                if (userId === 'usr_a')
                    throw createRequestError('not found', 404, 'users/usr_a');
                return {
                    bio: 'known',
                    status: 'active',
                    statusDescription: ''
                };
            });
        const wait = vi
            .fn()
            .mockImplementation(async (milliseconds: number) => {
                events.push(`wait:${milliseconds}`);
            });
        const run = createProfileFetchExecutor({
            getFriends: () => ({
                usr_a: { id: 'usr_a' },
                usr_b: { id: 'usr_b' }
            }),
            isAccountCurrent: () => true,
            loadTracked: vi.fn().mockResolvedValue(undefined),
            getTracked: () => ({ currentUserId: 'usr_owner', entries: [] }),
            getUserProfile,
            reconcile: vi
                .fn()
                .mockResolvedValue({ bioUpdated: false, statusUpdated: false }),
            wait
        });
        const outcome = await run(context());
        expect(events).toEqual(['request:usr_a', 'wait:350', 'request:usr_b']);
        expect(outcome).toMatchObject({ result: { failed: 1 } });
    });
});
