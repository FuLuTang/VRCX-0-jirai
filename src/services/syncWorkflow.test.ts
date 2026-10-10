import { describe, expect, it, vi } from 'vitest';

import {
    createStartupOnlineBackfillExecutor,
    startupOnlineBackfillExecutor
} from './startupOnlineBackfillExecutor';
import {
    createSyncWorkflowRunner,
    type SyncWorkflowAction
} from './syncWorkflow';
import { createSyncWorkflowActions } from './syncWorkflowActions';

const context = {
    accountId: 'usr_current',
    translate: (key: string) =>
        ({
            'workflow.skip.cancelled_by_user': '已由用户取消。',
            'workflow.skip.cancelled_before_execution': '在执行前已取消。'
        })[key] ?? key
};

function action(
    id: string,
    run: SyncWorkflowAction['run'],
    cancel = () => {}
): SyncWorkflowAction {
    return {
        id,
        label: id,
        status: 'pending',
        run,
        cancel
    };
}

describe('SyncWorkflowRunner', () => {
    it('reports running and final status summaries with skip reasons', async () => {
        let finishFirst: (() => void) | undefined;
        const runner = createSyncWorkflowRunner();
        const run = runner.run(
            [
                action(
                    'complete',
                    () =>
                        new Promise((resolve) => {
                            finishFirst = () =>
                                resolve({ status: 'completed' });
                        })
                ),
                action('skip', async () => ({
                    status: 'skipped',
                    skipReason: 'Dependency missing.'
                })),
                action('error', async () => {
                    throw new Error('Executor failed.');
                })
            ],
            context
        );

        expect(runner.getSnapshot().summary).toMatchObject({
            total: 3,
            progress: 1,
            completed: 0,
            skipped: 0,
            error: 0,
            running: 1
        });

        finishFirst?.();
        const snapshot = await run;
        expect(snapshot.summary).toMatchObject({
            total: 3,
            progress: 3,
            completed: 1,
            skipped: 1,
            error: 1,
            running: 0
        });
        expect(snapshot.actions[1].skipReason).toBe('Dependency missing.');
        expect(snapshot.actions[2].errorMessage).toBe('Executor failed.');
    });

    it('cancels the active action and records why remaining actions skipped', async () => {
        const cancel = vi.fn();
        const runner = createSyncWorkflowRunner();
        const run = runner.run(
            [
                action(
                    'active',
                    ({ signal }) =>
                        new Promise((_, reject) => {
                            signal.addEventListener('abort', () =>
                                reject(
                                    new DOMException('Cancelled', 'AbortError')
                                )
                            );
                        }),
                    cancel
                ),
                action('later', async () => ({ status: 'completed' }))
            ],
            context
        );

        expect(runner.cancelCurrent()).toBe(true);
        const snapshot = await run;

        expect(cancel).toHaveBeenCalledOnce();
        expect(snapshot.summary).toMatchObject({
            progress: 2,
            skipped: 2,
            running: 0
        });
        expect(snapshot.actions[0].skipReason).toBe('已由用户取消。');
        expect(snapshot.actions[1].skipReason).toBe('在执行前已取消。');
    });

    it('creates isolated state for consecutive runs', async () => {
        const runner = createSyncWorkflowRunner();
        await runner.run(
            [
                action('first', async () => {
                    throw new Error('First run failure.');
                })
            ],
            context
        );

        let finishSecond: (() => void) | undefined;
        const secondRun = runner.run(
            [
                action(
                    'second',
                    () =>
                        new Promise((resolve) => {
                            finishSecond = () =>
                                resolve({ status: 'completed' });
                        })
                )
            ],
            context
        );

        expect(runner.getSnapshot()).toMatchObject({
            runId: 2,
            running: true,
            actions: [
                {
                    id: 'second',
                    status: 'running',
                    errorMessage: undefined
                }
            ]
        });
        finishSecond?.();
        await secondRun;
        expect(runner.getSnapshot().summary).toMatchObject({
            completed: 1,
            error: 0
        });
    });
});

describe('createSyncWorkflowActions', () => {
    it('keeps the supported action ids stable and registers task 05', async () => {
        const actions = createSyncWorkflowActions({
            translate: (key) => key
        });
        expect(actions.map((item) => item.id)).toEqual([
            'startup-online-backfill',
            'tracked-non-friends-sync',
            'manual-relations-sync',
            'automatic-profile-fetch',
            'relationship-recommendations'
        ]);
        expect(actions[0].run).toBe(startupOnlineBackfillExecutor);
        const trackedNonfriendsRefresh = vi.fn(async () => ({
            status: 'completed' as const
        }));
        const actionsWithTrackedRefresh = createSyncWorkflowActions({
            translate: (key) => key,
            trackedNonfriendsRefresh
        });
        expect(actionsWithTrackedRefresh[1].run).toBe(trackedNonfriendsRefresh);

        const runner = createSyncWorkflowRunner();
        const snapshot = await runner.run(actions, context);
        expect(snapshot.actions[0]).toMatchObject({
            status: 'skipped',
            skipReason: 'workflow.skip.startup_online_backfill_unavailable'
        });
    });
});

describe('startup online backfill executor', () => {
    function readyRoster(friendsById: Record<string, unknown>) {
        return {
            currentUserId: 'usr_current',
            loadStatus: 'ready',
            friendsById,
            orderedFriendIds: [],
            onlineIds: [],
            activeIds: [],
            offlineIds: [],
            detail: '',
            lastLoadedAt: null
        } as never;
    }

    it('writes only online friends and reports unavailable states as skipped', async () => {
        const insertObservedOnline = vi
            .fn()
            .mockResolvedValue({ inserted: true });
        const executor = createStartupOnlineBackfillExecutor({
            getRoster: () =>
                readyRoster({
                    first: {
                        id: 'usr_online',
                        displayName: 'Online',
                        state: 'online'
                    },
                    duplicate: {
                        id: 'usr_online',
                        displayName: 'Online',
                        state: 'online'
                    },
                    offline: {
                        id: 'usr_offline',
                        displayName: 'Offline',
                        state: 'offline'
                    },
                    unknown: {
                        id: 'usr_unknown',
                        displayName: 'Unknown',
                        state: 'unknown'
                    }
                }),
            insertObservedOnline
        });

        const outcome = await executor({
            ...context,
            signal: new AbortController().signal
        });

        expect(insertObservedOnline).toHaveBeenCalledTimes(1);
        expect(insertObservedOnline).toHaveBeenCalledWith({
            targetUserId: 'usr_online',
            displayName: 'Online'
        });
        expect(outcome).toEqual({
            status: 'completed',
            result: {
                onlineFriendsProcessed: 1,
                inserted: 1,
                alreadyOnline: 0,
                skippedOffline: 1,
                skippedUnavailableState: 1,
                skippedDuplicate: 1
            }
        });
    });

    it('does not process a later friend after cancellation', async () => {
        const controller = new AbortController();
        const insertObservedOnline = vi.fn(async () => {
            controller.abort();
            return { inserted: true };
        });
        const executor = createStartupOnlineBackfillExecutor({
            getRoster: () =>
                readyRoster({
                    first: { id: 'usr_first', state: 'online' },
                    second: { id: 'usr_second', state: 'online' }
                }),
            insertObservedOnline
        });

        await expect(
            executor({ ...context, signal: controller.signal })
        ).rejects.toMatchObject({ name: 'AbortError' });
        expect(insertObservedOnline).toHaveBeenCalledTimes(1);
    });
});
