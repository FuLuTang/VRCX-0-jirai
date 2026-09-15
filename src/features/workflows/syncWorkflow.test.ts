import { describe, expect, it, vi } from 'vitest';

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
    it('keeps the supported action ids stable and defaults task 05 to skipped', async () => {
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

        const runner = createSyncWorkflowRunner();
        const snapshot = await runner.run(actions, context);
        expect(snapshot.actions[0]).toMatchObject({
            status: 'skipped',
            skipReason: 'workflow.skip.not_implemented'
        });
    });
});
