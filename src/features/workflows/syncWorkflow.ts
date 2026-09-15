export type SyncWorkflowActionStatus =
    | 'completed'
    | 'skipped'
    | 'error'
    | 'running'
    | 'pending';

export type SyncWorkflowActionOutcome =
    | { status: 'completed' }
    | { status: 'skipped'; skipReason: string };

export type SyncWorkflowActionContext = {
    accountId: string;
    signal: AbortSignal;
    translate: (key: string) => string;
};

export type SyncWorkflowAction = {
    id: string;
    label: string;
    status: SyncWorkflowActionStatus;
    skipReason?: string;
    errorMessage?: string;
    run: (
        context: SyncWorkflowActionContext
    ) => Promise<SyncWorkflowActionOutcome | void>;
    cancel: () => void;
};

export type SyncWorkflowSummary = {
    total: number;
    progress: number;
    completed: number;
    skipped: number;
    error: number;
    running: number;
    pending: number;
};

export type SyncWorkflowSnapshot = {
    runId: number;
    running: boolean;
    actions: SyncWorkflowAction[];
    summary: SyncWorkflowSummary;
};

type SyncWorkflowListener = (snapshot: SyncWorkflowSnapshot) => void;

export function summarizeSyncWorkflowActions(
    actions: readonly SyncWorkflowAction[]
): SyncWorkflowSummary {
    const summary: SyncWorkflowSummary = {
        total: actions.length,
        progress: 0,
        completed: 0,
        skipped: 0,
        error: 0,
        running: 0,
        pending: 0
    };

    for (const action of actions) {
        summary[action.status] += 1;
        if (action.status !== 'pending') {
            summary.progress += 1;
        }
    }

    return summary;
}

function cloneAction(action: SyncWorkflowAction): SyncWorkflowAction {
    return {
        ...action,
        status: 'pending',
        skipReason: undefined,
        errorMessage: undefined
    };
}

function isAbortError(error: unknown): boolean {
    return error instanceof DOMException
        ? error.name === 'AbortError'
        : error instanceof Error && error.name === 'AbortError';
}

/**
 * Runs one account-scoped workflow at a time. A new run always gets a fresh
 * action list, so finished states cannot leak into the next run.
 */
export class SyncWorkflowRunner {
    private listeners = new Set<SyncWorkflowListener>();
    private runId = 0;
    private activeController: AbortController | null = null;
    private activeAction: SyncWorkflowAction | null = null;
    private cancellationRequested = false;
    private snapshot: SyncWorkflowSnapshot = {
        runId: 0,
        running: false,
        actions: [],
        summary: summarizeSyncWorkflowActions([])
    };

    subscribe(listener: SyncWorkflowListener): () => void {
        this.listeners.add(listener);
        listener(this.snapshot);
        return () => this.listeners.delete(listener);
    }

    getSnapshot(): SyncWorkflowSnapshot {
        return this.snapshot;
    }

    cancelCurrent(): boolean {
        if (!this.activeController) {
            return false;
        }
        this.cancellationRequested = true;
        this.activeAction?.cancel();
        this.activeController.abort();
        return true;
    }

    async run(
        actions: readonly SyncWorkflowAction[],
        context: Omit<SyncWorkflowActionContext, 'signal'>
    ): Promise<SyncWorkflowSnapshot> {
        if (this.snapshot.running) {
            return this.snapshot;
        }

        const runActions = actions.map(cloneAction);
        this.cancellationRequested = false;
        this.snapshot = {
            runId: ++this.runId,
            running: true,
            actions: runActions,
            summary: summarizeSyncWorkflowActions(runActions)
        };
        this.publish();

        for (let index = 0; index < runActions.length; index += 1) {
            const action = runActions[index];
            if (this.cancellationRequested) {
                this.skipRemaining(
                    runActions,
                    index,
                    context.translate(
                        'workflow.skip.cancelled_before_execution'
                    )
                );
                break;
            }

            const controller = new AbortController();
            this.activeController = controller;
            this.activeAction = action;
            action.status = 'running';
            this.refresh(true, runActions);

            try {
                const outcome = await action.run({
                    ...context,
                    signal: controller.signal
                });
                if (this.cancellationRequested || controller.signal.aborted) {
                    action.status = 'skipped';
                    action.skipReason = context.translate(
                        'workflow.skip.cancelled_by_user'
                    );
                } else if (outcome?.status === 'skipped') {
                    action.status = 'skipped';
                    action.skipReason = outcome.skipReason;
                } else {
                    action.status = 'completed';
                }
            } catch (error) {
                if (
                    this.cancellationRequested ||
                    controller.signal.aborted ||
                    isAbortError(error)
                ) {
                    action.status = 'skipped';
                    action.skipReason = context.translate(
                        'workflow.skip.cancelled_by_user'
                    );
                } else {
                    action.status = 'error';
                    action.errorMessage =
                        error instanceof Error ? error.message : String(error);
                }
            } finally {
                this.activeController = null;
                this.activeAction = null;
            }

            this.refresh(true, runActions);
            if (this.cancellationRequested) {
                this.skipRemaining(
                    runActions,
                    index + 1,
                    context.translate(
                        'workflow.skip.cancelled_before_execution'
                    )
                );
                break;
            }
        }

        this.snapshot = {
            ...this.snapshot,
            running: false,
            actions: runActions,
            summary: summarizeSyncWorkflowActions(runActions)
        };
        this.publish();
        return this.snapshot;
    }

    private skipRemaining(
        actions: SyncWorkflowAction[],
        startIndex: number,
        skipReason: string
    ): void {
        for (let index = startIndex; index < actions.length; index += 1) {
            if (actions[index].status === 'pending') {
                actions[index].status = 'skipped';
                actions[index].skipReason = skipReason;
            }
        }
        this.refresh(true, actions);
    }

    private refresh(running: boolean, actions: SyncWorkflowAction[]): void {
        this.snapshot = {
            ...this.snapshot,
            running,
            actions,
            summary: summarizeSyncWorkflowActions(actions)
        };
        this.publish();
    }

    private publish(): void {
        for (const listener of this.listeners) {
            listener(this.snapshot);
        }
    }
}

export function createSyncWorkflowRunner(): SyncWorkflowRunner {
    return new SyncWorkflowRunner();
}
