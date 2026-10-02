import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { formatDateTime } from '@/lib/dateTime';
import { useEnhancedInfoFetchSnapshot } from '@/lib/useEnhancedInfoFetchSnapshot';
import {
    cancelEnhancedInfoFetch,
    runEnhancedInfoFetch
} from '@/services/enhancedInfoFetchService';
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

type SyncWorkflowDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    accountId: string;
    accountLabel: string;
};
const resultFields = [
    'succeeded',
    'unchanged',
    'failed',
    'incomplete',
    'bioUpdated',
    'statusUpdated'
] as const;

export function SyncWorkflowDialog({
    open,
    onOpenChange,
    accountId,
    accountLabel
}: SyncWorkflowDialogProps) {
    const { t } = useTranslation();
    const snapshot = useEnhancedInfoFetchSnapshot();
    const [requestError, setRequestError] = useState(false);
    const [starting, setStarting] = useState(false);
    // Never display the previous account's results under the new account.
    const current = Boolean(accountId) && snapshot.accountId === accountId;
    const running = current && snapshot.running;
    const phase = current ? snapshot.phase : 'idle';
    const total = current ? snapshot.total : 0;
    const processed = current ? snapshot.processed : 0;
    const progress =
        total > 0 ? Math.min(100, Math.max(0, (processed / total) * 100)) : 0;
    async function start() {
        setRequestError(false);
        setStarting(true);
        try {
            await runEnhancedInfoFetch('manual');
        } catch {
            setRequestError(true);
        } finally {
            setStarting(false);
        }
    }
    async function cancel() {
        try {
            await cancelEnhancedInfoFetch();
        } catch {
            setRequestError(true);
        }
    }
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[85vh] min-h-0 flex-col overflow-hidden sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {t('view.tools.system_tools.info_completion')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('enhanced_info_fetch.description', {
                            account:
                                accountLabel ||
                                t('workflow.account_unavailable')
                        })}
                    </DialogDescription>
                </DialogHeader>
                <div className="min-h-0 space-y-5 overflow-y-auto">
                    {!accountId ? (
                        <p role="status">
                            {t('workflow.skip.account_required')}
                        </p>
                    ) : null}
                    <section
                        aria-label={t('enhanced_info_fetch.overview')}
                        className="space-y-2 rounded-md border p-3"
                    >
                        <h2 className="text-sm font-medium">
                            {t('enhanced_info_fetch.overview')}
                        </h2>
                        <p role="status" aria-live="polite">
                            {t(`enhanced_info_fetch.phase.${phase}`)}
                        </p>
                        {current && snapshot.source ? (
                            <p className="text-muted-foreground text-xs">
                                {t('enhanced_info_fetch.source', {
                                    source: t(
                                        `enhanced_info_fetch.sources.${snapshot.source}`
                                    )
                                })}
                            </p>
                        ) : null}
                        <Progress
                            value={progress}
                            aria-label={t('enhanced_info_fetch.progress')}
                        />
                        <p className="text-sm tabular-nums">
                            {t('enhanced_info_fetch.processed', {
                                processed,
                                total
                            })}
                        </p>
                        {current && snapshot.currentTarget ? (
                            <p className="text-sm break-all">
                                {t('enhanced_info_fetch.target', {
                                    target:
                                        snapshot.currentTarget.displayName ||
                                        snapshot.currentTarget.userId
                                })}
                            </p>
                        ) : null}
                        {current && snapshot.pauseReason ? (
                            <p role="status">
                                {t('enhanced_info_fetch.pause_reason', {
                                    reason: snapshot.pauseReason
                                })}
                            </p>
                        ) : null}
                        <p className="text-muted-foreground text-xs">
                            {current && snapshot.nextRunAt
                                ? t('enhanced_info_fetch.next_run', {
                                      time: formatDateTime(snapshot.nextRunAt, {
                                          year: 'numeric',
                                          month: '2-digit',
                                          day: '2-digit',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                          second: '2-digit'
                                      })
                                  })
                                : t('enhanced_info_fetch.next_run_unknown')}
                        </p>
                    </section>
                    <section
                        aria-label={t('enhanced_info_fetch.strategy')}
                        className="space-y-2 rounded-md border p-3 text-sm"
                    >
                        <h2 className="font-medium">
                            {t('enhanced_info_fetch.strategy')}
                        </h2>
                        <ul className="list-disc space-y-2 pl-5">
                            <li>{t('enhanced_info_fetch.strategy_auto')}</li>
                            <li>{t('enhanced_info_fetch.strategy_profile')}</li>
                            <li>{t('enhanced_info_fetch.strategy_manual')}</li>
                        </ul>
                    </section>
                    <section
                        aria-label={t('enhanced_info_fetch.results')}
                        className="space-y-2 rounded-md border p-3"
                    >
                        <h2 className="text-sm font-medium">
                            {t('enhanced_info_fetch.results')}
                        </h2>
                        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                            {resultFields.map((field) => (
                                <div key={field}>
                                    <dt className="text-muted-foreground">
                                        {t(
                                            `enhanced_info_fetch.counts.${field}`
                                        )}
                                    </dt>
                                    <dd
                                        className="tabular-nums"
                                        data-testid={`count-${field}`}
                                    >
                                        {current ? snapshot[field] : 0}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                        <p className="text-muted-foreground text-xs">
                            {t('enhanced_info_fetch.results_note')}
                        </p>
                    </section>
                    {current && snapshot.errorMessage ? (
                        <p role="alert" className="text-destructive">
                            {t('enhanced_info_fetch.error_detail', {
                                error: snapshot.errorMessage
                            })}
                        </p>
                    ) : null}
                    {requestError ? (
                        <p role="alert" className="text-destructive">
                            {t('enhanced_info_fetch.request_error')}
                        </p>
                    ) : null}
                    <p className="text-muted-foreground text-xs">
                        {t('enhanced_info_fetch.background_hint')}
                    </p>
                </div>
                <DialogFooter>
                    <Button
                        disabled={
                            !accountId.trim() || snapshot.running || starting
                        }
                        onClick={() => void start()}
                    >
                        {t('enhanced_info_fetch.run')}
                    </Button>
                    {running ? (
                        <Button
                            variant="destructive"
                            onClick={() => void cancel()}
                        >
                            {t('enhanced_info_fetch.cancel')}
                        </Button>
                    ) : null}
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        {t('enhanced_info_fetch.close')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
