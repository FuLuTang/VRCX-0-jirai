import {
    CheckCircle2Icon,
    CircleDashedIcon,
    CircleXIcon,
    LoaderCircleIcon,
    MinusCircleIcon
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/ui/shadcn/badge';
import { Button } from '@/ui/shadcn/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/ui/shadcn/dialog';
import { Progress } from '@/ui/shadcn/progress';

import type {
    SyncWorkflowAction,
    SyncWorkflowActionStatus,
    SyncWorkflowSnapshot
} from './syncWorkflow';
import {
    createSyncWorkflowRunner,
    summarizeSyncWorkflowActions,
    type SyncWorkflowRunner
} from './syncWorkflow';
import { createSyncWorkflowActions } from './syncWorkflowActions';

type SyncWorkflowDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    accountId: string;
    accountLabel: string;
    actionsFactory?: () => SyncWorkflowAction[];
    runner?: SyncWorkflowRunner;
};

const statusIcon: Record<SyncWorkflowActionStatus, typeof CheckCircle2Icon> = {
    completed: CheckCircle2Icon,
    skipped: MinusCircleIcon,
    error: CircleXIcon,
    running: LoaderCircleIcon,
    pending: CircleDashedIcon
};

const statusTone: Record<SyncWorkflowActionStatus, string> = {
    completed: 'text-emerald-600 dark:text-emerald-400',
    skipped: 'text-violet-600 dark:text-violet-400',
    error: 'text-destructive',
    running: 'text-primary',
    pending: 'text-muted-foreground'
};

function statusBadgeVariant(status: SyncWorkflowActionStatus) {
    if (status === 'error') return 'destructive' as const;
    if (status === 'completed') return 'default' as const;
    return 'secondary' as const;
}

export function SyncWorkflowDialog({
    open,
    onOpenChange,
    accountId,
    accountLabel,
    actionsFactory,
    runner: suppliedRunner
}: SyncWorkflowDialogProps) {
    const { t } = useTranslation();
    const runnerRef = useRef<SyncWorkflowRunner | null>(null);
    if (!runnerRef.current) {
        runnerRef.current = suppliedRunner ?? createSyncWorkflowRunner();
    }
    const runner = runnerRef.current;
    const [snapshot, setSnapshot] = useState<SyncWorkflowSnapshot>(() =>
        runner.getSnapshot()
    );

    useEffect(() => runner.subscribe(setSnapshot), [runner]);

    const actions = useMemo(
        () =>
            actionsFactory
                ? actionsFactory()
                : createSyncWorkflowActions({ translate: t }),
        [actionsFactory, t]
    );
    const displayActions =
        snapshot.actions.length > 0 ? snapshot.actions : actions;
    const displaySummary =
        snapshot.actions.length > 0
            ? snapshot.summary
            : summarizeSyncWorkflowActions(displayActions);
    const hasCurrentAccount = accountId.trim().length > 0;
    const currentAccountLabel =
        accountLabel || t('workflow.account_unavailable');
    const progressPercent =
        displaySummary.total === 0
            ? 0
            : Math.round(
                  (displaySummary.progress / displaySummary.total) * 100
              );

    function runWorkflow() {
        if (!hasCurrentAccount) {
            return;
        }
        void runner.run(actions, { accountId, translate: t });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[85vh] min-h-0 flex-col gap-0 overflow-hidden sm:max-w-2xl">
                <DialogHeader className="border-b px-6 py-5">
                    <DialogTitle>{t('workflow.title')}</DialogTitle>
                    <DialogDescription>
                        {t('workflow.description', {
                            account: currentAccountLabel
                        })}
                    </DialogDescription>
                </DialogHeader>

                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                    {!hasCurrentAccount ? (
                        <p
                            className="text-destructive mb-3 text-sm"
                            role="status"
                        >
                            {t('workflow.skip_reason')}:{' '}
                            {t('workflow.skip.account_required')}
                        </p>
                    ) : null}
                    <div
                        className="space-y-2"
                        aria-label={t('workflow.action_list')}
                    >
                        {displayActions.map((action) => {
                            const StatusIcon = statusIcon[action.status];
                            const statusLabel = t(
                                `workflow.status.${action.status}`
                            );
                            return (
                                <div
                                    key={action.id}
                                    className="rounded-md border px-3 py-3"
                                >
                                    <div className="flex items-center gap-3">
                                        <StatusIcon
                                            aria-hidden="true"
                                            className={`size-5 shrink-0 ${statusTone[action.status]} ${action.status === 'running' ? 'animate-spin' : ''}`}
                                        />
                                        <span className="min-w-0 flex-1 text-sm font-medium">
                                            {action.label}
                                        </span>
                                        <Badge
                                            variant={statusBadgeVariant(
                                                action.status
                                            )}
                                            role="status"
                                            aria-label={statusLabel}
                                        >
                                            {statusLabel}
                                        </Badge>
                                    </div>
                                    {action.skipReason ? (
                                        <p className="text-muted-foreground mt-2 pl-8 text-xs">
                                            {t('workflow.skip_reason')}:{' '}
                                            {action.skipReason}
                                        </p>
                                    ) : null}
                                    {action.errorMessage ? (
                                        <p className="text-destructive mt-2 pl-8 text-xs">
                                            {action.errorMessage}
                                        </p>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="border-t px-6 py-4">
                    <Progress
                        value={progressPercent}
                        aria-label={t('workflow.progress_bar')}
                    />
                    <p className="mt-3 text-sm tabular-nums" role="status">
                        {t('workflow.summary', {
                            progress: displaySummary.progress,
                            total: displaySummary.total,
                            completed: displaySummary.completed,
                            skipped: displaySummary.skipped,
                            error: displaySummary.error,
                            running: displaySummary.running
                        })}
                    </p>
                </div>

                <DialogFooter className="border-t px-6 py-4 sm:justify-between">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={runWorkflow}
                        disabled={snapshot.running || !hasCurrentAccount}
                    >
                        {snapshot.running
                            ? t('workflow.running')
                            : t('workflow.run')}
                    </Button>
                    {snapshot.running ? (
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={() => runner.cancelCurrent()}
                        >
                            {t('workflow.cancel_current')}
                        </Button>
                    ) : null}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
