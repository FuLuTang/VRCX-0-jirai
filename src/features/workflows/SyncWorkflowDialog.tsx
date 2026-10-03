import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useRelationshipRecommendations } from '@/features/charts/relationship-recommendations/relationshipRecommendationsService';
import { formatDateTime } from '@/lib/dateTime';
import { useEnhancedInfoFetchSnapshot } from '@/lib/useEnhancedInfoFetchSnapshot';
import configRepository from '@/repositories/configRepository';
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

import { useEnhancedFetchSchedule } from './useEnhancedFetchSchedule';

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
    const schedule = useEnhancedFetchSchedule(open, accountId);
    const socialJob = schedule?.jobs.find(
        (job) => job.name === 'backgroundSocialBaselineRefresh'
    );
    const [requestError, setRequestError] = useState(false);
    const [starting, setStarting] = useState(false);
    const [automaticEnabled, setAutomaticEnabled] = useState<boolean | null>(
        null
    );
    useEffect(() => {
        if (!open) return;
        let disposed = false;
        const read = () => {
            void configRepository
                .getBool('enhancedInfoFetchEnabled', true)
                .then((enabled) => {
                    if (!disposed) setAutomaticEnabled(enabled);
                })
                .catch(() => {
                    if (!disposed) setAutomaticEnabled(null);
                });
        };
        read();
        const timer = setInterval(read, 10_000);
        return () => {
            disposed = true;
            clearInterval(timer);
        };
    }, [open]);
    const [now, setNow] = useState(Date.now);
    useEffect(() => {
        if (!open) return;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [open]);
    const relationships = useRelationshipRecommendations(
        (state) => state.accounts[accountId]
    );
    // Never display the previous account's results under the new account.
    const current = Boolean(accountId) && snapshot.accountId === accountId;
    const running =
        current && snapshot.running && snapshot.phase !== 'cancelled';
    const phase = current ? snapshot.phase : 'idle';
    const total = current ? snapshot.total : 0;
    const processed = current ? snapshot.processed : 0;
    const progress =
        total > 0 ? Math.min(100, Math.max(0, (processed / total) * 100)) : 0;
    const relationshipStatus = current
        ? phase === 'cancelled' && snapshot.relationshipStatus === 'running'
            ? 'cancelled'
            : snapshot.relationshipStatus
        : 'waiting';
    const relationshipProgress =
        relationshipStatus === 'completed'
            ? 100
            : current &&
                relationshipStatus !== 'waiting' &&
                relationshipStatus !== 'unavailable' &&
                relationships?.progress?.total
              ? Math.min(
                    100,
                    Math.max(
                        0,
                        (relationships.progress.done /
                            relationships.progress.total) *
                            100
                    )
                )
              : 0;
    const collectionProgress =
        total === 0 && current && snapshot.collectionStatus === 'completed'
            ? 100
            : progress;
    const collectionStatus = current ? snapshot.collectionStatus : 'idle';
    const hourlyStatus =
        phase === 'completed' && relationshipStatus === 'unavailable'
            ? 'partial'
            : phase;
    function countdown(deadline: string | null | undefined) {
        if (!deadline || !Number.isFinite(Date.parse(deadline))) return null;
        const seconds = Math.max(
            0,
            Math.ceil((Date.parse(deadline) - now) / 1000)
        );
        return `${Math.floor(seconds / 3600)
            .toString()
            .padStart(2, '0')}:${Math.floor((seconds / 60) % 60)
            .toString()
            .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    }
    async function start() {
        setRequestError(false);
        setStarting(true);
        try {
            await runEnhancedInfoFetch();
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
    function scheduledTime(deadline: string | null | undefined) {
        const remaining = countdown(deadline);
        return remaining
            ? t('enhanced_info_fetch.scheduled', {
                  time: formatDateTime(deadline, {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                  }),
                  countdown: remaining
              })
            : t('enhanced_info_fetch.schedule_unavailable');
    }
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[85vh] min-h-0 flex-col gap-3 overflow-hidden sm:max-w-4xl">
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
                <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
                    {!accountId ? (
                        <p role="status">
                            {t('workflow.skip.account_required')}
                        </p>
                    ) : null}
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                        <p
                            className="text-sm font-medium tabular-nums"
                            data-testid="roster-counts"
                        >
                            {t('enhanced_info_fetch.roster_counts', {
                                friends: current ? snapshot.friendsTotal : 0,
                                tracked: current ? snapshot.trackedTotal : 0
                            })}
                        </p>
                        <p
                            role="status"
                            className="text-muted-foreground text-xs"
                        >
                            {t(
                                automaticEnabled === false
                                    ? 'enhanced_info_fetch.automatic_disabled'
                                    : automaticEnabled === true
                                      ? 'enhanced_info_fetch.automatic_enabled'
                                      : 'enhanced_info_fetch.automatic_unknown'
                            )}
                        </p>
                    </div>
                    <section
                        aria-label={t('enhanced_info_fetch.hourly_title')}
                        className="min-w-0 space-y-3 rounded-lg border p-3"
                        data-testid="flow-hourly"
                    >
                        <div className="flex items-center justify-between gap-2">
                            <h2 className="text-sm font-medium">
                                {t('enhanced_info_fetch.hourly_title')}
                            </h2>
                            <span
                                role="status"
                                aria-live="polite"
                                className="bg-muted rounded-full px-2 py-0.5 text-xs"
                            >
                                {t(
                                    `enhanced_info_fetch.hourly_status.${hourlyStatus}`
                                )}
                            </span>
                        </div>
                        <p className="text-muted-foreground text-xs leading-snug">
                            {t('enhanced_info_fetch.hourly_description')}
                        </p>
                        <div
                            className="grid gap-2 sm:grid-cols-2"
                            data-testid="hourly-tasks"
                        >
                            <div
                                className="bg-muted/30 min-w-0 space-y-1.5 rounded-md p-2.5"
                                data-testid="task-collection"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <h3 className="text-xs font-medium">
                                        {t(
                                            'enhanced_info_fetch.collection_title'
                                        )}
                                    </h3>
                                    <span className="text-xs tabular-nums">
                                        {Math.floor(collectionProgress)}%
                                    </span>
                                </div>
                                <Progress
                                    value={collectionProgress}
                                    aria-label={t(
                                        'enhanced_info_fetch.progress'
                                    )}
                                />
                                <p
                                    role="status"
                                    className="text-muted-foreground text-xs"
                                >
                                    {t(
                                        `enhanced_info_fetch.collection_status.${collectionStatus}`
                                    )}
                                </p>
                                <p className="text-xs tabular-nums">
                                    {t('enhanced_info_fetch.processed', {
                                        processed,
                                        total
                                    })}
                                </p>
                                {current && snapshot.currentTarget ? (
                                    <p
                                        className="truncate text-xs"
                                        title={
                                            snapshot.currentTarget
                                                .displayName ||
                                            snapshot.currentTarget.userId
                                        }
                                    >
                                        {t('enhanced_info_fetch.target', {
                                            target:
                                                snapshot.currentTarget
                                                    .displayName ||
                                                snapshot.currentTarget.userId
                                        })}
                                    </p>
                                ) : null}
                                {current && snapshot.pauseReason ? (
                                    <p role="status" className="text-xs">
                                        {t('enhanced_info_fetch.pause_reason', {
                                            reason: snapshot.pauseReason
                                        })}
                                    </p>
                                ) : null}
                                {current && snapshot.nextRunAt ? (
                                    <p className="text-muted-foreground text-xs">
                                        {t('enhanced_info_fetch.next_run', {
                                            time: formatDateTime(
                                                snapshot.nextRunAt,
                                                {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                    second: '2-digit'
                                                }
                                            ),
                                            countdown: countdown(
                                                snapshot.nextRunAt
                                            )
                                        })}
                                    </p>
                                ) : null}
                            </div>
                            <div
                                className="bg-muted/30 min-w-0 space-y-1.5 rounded-md p-2.5"
                                data-testid="task-relationships"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <h3 className="text-xs font-medium">
                                        {t(
                                            'enhanced_info_fetch.relationship_title'
                                        )}
                                    </h3>
                                    <span
                                        className="text-xs tabular-nums"
                                        data-testid="relationship-progress"
                                    >
                                        {Math.floor(relationshipProgress)}%
                                    </span>
                                </div>
                                <Progress
                                    value={relationshipProgress}
                                    aria-label={t(
                                        'enhanced_info_fetch.relationship_progress'
                                    )}
                                />
                                <p
                                    role="status"
                                    className="text-muted-foreground text-xs"
                                >
                                    {t(
                                        `enhanced_info_fetch.relationship_status.${relationshipStatus}`
                                    )}
                                </p>
                                {current &&
                                relationshipStatus === 'running' &&
                                relationships?.progress ? (
                                    <p className="text-xs">
                                        {relationships.progress.step} ·{' '}
                                        {relationships.progress.done} /{' '}
                                        {relationships.progress.total}
                                    </p>
                                ) : null}
                                {current &&
                                relationshipStatus === 'completed' &&
                                relationships ? (
                                    <p className="text-xs tabular-nums">
                                        {t('enhanced_info_fetch.suggestions', {
                                            count: relationships.suggestions
                                                .length
                                        })}
                                    </p>
                                ) : null}
                                {current && snapshot.relationshipError ? (
                                    <p
                                        role="alert"
                                        className="text-destructive text-xs break-words"
                                    >
                                        {snapshot.relationshipError}
                                    </p>
                                ) : null}
                            </div>
                        </div>
                        <div className="space-y-1 border-t pt-2 text-xs">
                            {current && snapshot.source ? (
                                <p className="text-muted-foreground">
                                    {t('enhanced_info_fetch.source', {
                                        source: t(
                                            `enhanced_info_fetch.sources.${snapshot.source}`
                                        )
                                    })}
                                </p>
                            ) : null}
                            <p className="tabular-nums">
                                {automaticEnabled === false
                                    ? t('enhanced_info_fetch.hourly_disabled')
                                    : automaticEnabled === true
                                      ? scheduledTime(socialJob?.nextRunAt)
                                      : t(
                                            'enhanced_info_fetch.automatic_unknown'
                                        )}
                            </p>
                            {socialJob ? (
                                <details className="text-muted-foreground">
                                    <summary className="cursor-pointer">
                                        {t('enhanced_info_fetch.job_status', {
                                            status: socialJob.status,
                                            seconds:
                                                socialJob.cadenceSeconds ?? '—',
                                            failures: socialJob.failureCount
                                        })}
                                    </summary>
                                    <div className="mt-1 space-y-1 break-words">
                                        <p>
                                            {t(
                                                'enhanced_info_fetch.job_times',
                                                {
                                                    started:
                                                        socialJob.lastStartedAt ||
                                                        '—',
                                                    finished:
                                                        socialJob.lastFinishedAt ||
                                                        '—'
                                                }
                                            )}
                                        </p>
                                        {socialJob.lastDetail ? (
                                            <p>{socialJob.lastDetail}</p>
                                        ) : null}
                                    </div>
                                </details>
                            ) : null}
                            {socialJob?.lastError ? (
                                <p
                                    role="alert"
                                    className="text-destructive break-words"
                                >
                                    {socialJob.lastError}
                                </p>
                            ) : null}
                            {schedule?.error ? (
                                <p role="status">
                                    {t('enhanced_info_fetch.schedule_error')}
                                </p>
                            ) : null}
                        </div>
                    </section>
                    <section
                        aria-label={t('enhanced_info_fetch.results')}
                        className="space-y-2"
                    >
                        <h2 className="text-sm font-medium">
                            {t('enhanced_info_fetch.results')}
                        </h2>
                        <dl
                            className="grid grid-cols-3 gap-2 sm:grid-cols-6"
                            data-testid="result-grid"
                        >
                            {resultFields.map((field) => (
                                <div
                                    key={field}
                                    className="bg-muted/30 min-w-0 rounded-md border p-2.5"
                                >
                                    <dt className="text-muted-foreground text-[11px] leading-snug">
                                        {t(
                                            `enhanced_info_fetch.counts.${field}`
                                        )}
                                    </dt>
                                    <dd
                                        className="mt-1 text-xl font-semibold tabular-nums"
                                        data-testid={`count-${field}`}
                                    >
                                        {current ? snapshot[field] : 0}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                        <p className="text-muted-foreground text-[11px] leading-snug">
                            {t('enhanced_info_fetch.results_note')}
                        </p>
                    </section>
                    {current && snapshot.errorMessage ? (
                        <p role="alert" className="text-destructive text-sm">
                            {t('enhanced_info_fetch.error_detail', {
                                error: snapshot.errorMessage
                            })}
                        </p>
                    ) : null}
                    {requestError ? (
                        <p role="alert" className="text-destructive text-sm">
                            {t('enhanced_info_fetch.request_error')}
                        </p>
                    ) : null}
                </div>
                <DialogFooter className="shrink-0 sm:items-center">
                    <p className="text-muted-foreground text-[11px] leading-snug sm:mr-auto sm:max-w-md">
                        {t('enhanced_info_fetch.background_hint')}
                    </p>
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
