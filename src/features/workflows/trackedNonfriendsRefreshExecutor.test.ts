import { describe, expect, it, vi } from 'vitest';

import { createTrackedNonfriendsRefreshExecutor } from './trackedNonfriendsRefreshExecutor';

const context = {
    accountId: 'usr_owner',
    signal: new AbortController().signal,
    translate: (key: string) => key
};

const entries = [
    {
        userId: 'usr_first',
        displayName: 'First',
        addedAt: '2026-01-01T00:00:00Z'
    },
    {
        userId: 'usr_second',
        displayName: 'Second',
        addedAt: '2026-01-01T00:00:01Z'
    }
];

describe('tracked nonfriend refresh executor', () => {
    it('rate limits requests and skips entries removed during the run', async () => {
        const tracked = new Set(entries.map((entry) => entry.userId));
        const getUserProfile = vi.fn(
            async ({ userId }: { userId?: string }) => {
                if (userId === 'usr_first') {
                    tracked.delete('usr_second');
                }
                return { displayName: `${userId} Name` } as never;
            }
        );
        const wait = vi.fn(
            async (_milliseconds: number, _signal: AbortSignal) => {}
        );
        const executor = createTrackedNonfriendsRefreshExecutor({
            getEntries: () => entries,
            load: async () => {},
            isTracked: (userId) => tracked.has(userId),
            updateName: vi.fn(async () => true),
            getUserProfile,
            wait
        });

        const outcome = await executor(context);

        expect(getUserProfile).toHaveBeenCalledTimes(1);
        expect(getUserProfile).toHaveBeenCalledWith({
            userId: 'usr_first',
            force: true,
            isFriend: false
        });
        expect(wait).toHaveBeenCalledTimes(1);
        expect(outcome).toEqual({
            status: 'completed',
            result: { refreshed: 1, skippedRemoved: 1 }
        });
    });

    it('waits before the second upstream profile request', async () => {
        const wait = vi.fn(
            async (_milliseconds: number, _signal: AbortSignal) => {}
        );
        const executor = createTrackedNonfriendsRefreshExecutor({
            getEntries: () => entries,
            load: async () => {},
            isTracked: () => true,
            updateName: vi.fn(async () => true),
            getUserProfile: vi.fn(
                async () => ({ displayName: 'Name' }) as never
            ),
            wait
        });

        await executor(context);

        expect(wait).toHaveBeenCalledTimes(2);
        expect(wait.mock.calls[0][0]).toBe(0);
        expect(wait.mock.calls[1][0]).toBeGreaterThan(0);
    });

    it('cancels before it can refresh a later tracked entry', async () => {
        const controller = new AbortController();
        const getUserProfile = vi.fn(async () => {
            controller.abort();
            return { displayName: 'First' } as never;
        });
        const executor = createTrackedNonfriendsRefreshExecutor({
            getEntries: () => entries,
            load: async () => {},
            isTracked: () => true,
            updateName: vi.fn(async () => true),
            getUserProfile,
            wait: async () => {}
        });

        await expect(
            executor({ ...context, signal: controller.signal })
        ).rejects.toMatchObject({ name: 'AbortError' });
        expect(getUserProfile).toHaveBeenCalledTimes(1);
    });
});
