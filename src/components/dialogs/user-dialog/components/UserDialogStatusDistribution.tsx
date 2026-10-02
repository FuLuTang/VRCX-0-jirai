import { RefreshCwIcon, ZoomInIcon, ZoomOutIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { echarts } from '@/lib/echarts';
import type { FeedRowOutput } from '@/platform/tauri/bindings';
import { useResolvedThemeMode } from '@/services/themeService';
import { useRuntimeStore } from '@/state/runtimeStore';
import { Button } from '@/ui/shadcn/button';
import {
    Card,
    CardAction,
    CardContent,
    CardHeader,
    CardTitle
} from '@/ui/shadcn/card';
import { Spinner } from '@/ui/shadcn/spinner';

import type { UserDialogProfileRecord } from '../userDialogProfileTypes';
import { formatStatsDuration } from '../userDialogRows';
import {
    buildStatusDistributionBuckets,
    STATUS_DISTRIBUTION_COLORS,
    STATUS_DISTRIBUTION_KEYS,
    statusBucketDays
} from './statusDistribution';
import { queryStatusDistributionHistory } from './statusDistributionQuery';

export function useStatusDistributionScale() {
    const [slider, setSlider] = useState(51);
    const [committedSlider, setCommittedSlider] = useState(51);
    useEffect(() => {
        const timer = setTimeout(() => setCommittedSlider(slider), 1000);
        return () => clearTimeout(timer);
    }, [slider]);
    return {
        slider,
        setSlider,
        bucketDays: statusBucketDays(slider),
        committedBucketDays: statusBucketDays(committedSlider)
    };
}

const escapeHtml = (value: string) =>
    value.replace(
        /[&<>"']/g,
        (char) =>
            ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            })[char]!
    );

export function UserDialogStatusDistribution({
    profile
}: {
    profile: UserDialogProfileRecord;
}) {
    const { t } = useTranslation();
    const owner = useRuntimeStore((state) => state.auth.currentUserId);
    const dark = useResolvedThemeMode() === 'dark';
    const self = owner === profile.id;
    const [rows, setRows] = useState<FeedRowOutput[]>([]);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);
    const [asOf, setAsOf] = useState(Date.now);
    const request = useRef(0);
    const chartElement = useRef<HTMLDivElement>(null);
    const scale = useStatusDistributionScale();
    useEffect(() => {
        request.current += 1;
        setRows([]);
        setLoading(false);
        setLoaded(false);
        setError(false);
        return () => {
            request.current += 1;
        };
    }, [owner, profile.id]);

    const load = async () => {
        if (!owner || !profile.id) return;
        const id = ++request.current;
        setLoading(true);
        setError(false);
        try {
            const next = await queryStatusDistributionHistory(
                owner,
                profile.id,
                () => request.current === id
            );
            if (request.current === id) {
                setRows(next);
                setAsOf(Date.now());
            }
        } catch {
            if (request.current === id) setError(true);
        } finally {
            if (request.current === id) {
                setLoading(false);
                setLoaded(true);
            }
        }
    };
    const buckets = useMemo(
        () =>
            buildStatusDistributionBuckets(
                rows,
                profile.id || '',
                scale.committedBucketDays,
                asOf,
                !self && typeof profile.state === 'string'
                    ? profile.state
                    : undefined
            ),
        [rows, profile.id, profile.state, scale.committedBucketDays, asOf, self]
    );
    const names = STATUS_DISTRIBUTION_KEYS.map((status) =>
        t(`dialog.user.info.status.${status.replace(' ', '_')}`)
    );
    const namesKey = JSON.stringify(names);

    useEffect(() => {
        if (!chartElement.current || !buckets.length || error) return;
        const chart = echarts.init(
            chartElement.current,
            dark ? 'dark' : undefined,
            { renderer: 'canvas' }
        );
        const labels: string[] = JSON.parse(namesKey);
        const zoomStart =
            buckets.length <= 10
                ? 0
                : ((buckets.length - 10) / buckets.length) * 100;
        chart.setOption(
            {
                backgroundColor: 'transparent',
                tooltip: {
                    trigger: 'axis',
                    confine: true,
                    formatter: (params: unknown) => {
                        const entries = Array.isArray(params) ? params : [];
                        const bucket =
                            buckets[
                                (
                                    entries[0] as
                                        | { dataIndex?: number }
                                        | undefined
                                )?.dataIndex ?? -1
                            ];
                        if (!bucket) return '';
                        return (
                            `<b>${escapeHtml(bucket.label)} (UTC)</b><br/>` +
                            STATUS_DISTRIBUTION_KEYS.filter(
                                (status) => bucket.seconds[status] > 0
                            )
                                .sort(
                                    (a, b) =>
                                        bucket.seconds[b] - bucket.seconds[a]
                                )
                                .map(
                                    (status) =>
                                        `<span style="color:${STATUS_DISTRIBUTION_COLORS[status]}">●</span> ${escapeHtml(labels[STATUS_DISTRIBUTION_KEYS.indexOf(status)])}: ${bucket.percentages[status].toFixed(1)}% · ${escapeHtml(formatStatsDuration(Math.round(bucket.seconds[status])))}`
                                )
                                .join('<br/>')
                        );
                    }
                },
                legend: {
                    top: 0,
                    textStyle: { color: dark ? '#ccc' : '#333', fontSize: 11 }
                },
                grid: {
                    left: 8,
                    right: 8,
                    top: 36,
                    bottom: 80,
                    containLabel: true
                },
                xAxis: {
                    type: 'category',
                    data: buckets.map((bucket) => bucket.label),
                    boundaryGap: false,
                    axisLabel: {
                        rotate: 30,
                        fontSize: 10,
                        color: dark ? '#bbb' : '#555'
                    }
                },
                yAxis: {
                    type: 'value',
                    max: 100,
                    axisLabel: {
                        formatter: '{value}%',
                        color: dark ? '#bbb' : '#555'
                    },
                    splitLine: { lineStyle: { color: dark ? '#333' : '#eee' } }
                },
                dataZoom: [
                    {
                        type: 'slider',
                        start: zoomStart,
                        end: 100,
                        bottom: 5,
                        height: 20
                    },
                    { type: 'inside', start: zoomStart, end: 100 }
                ],
                series: STATUS_DISTRIBUTION_KEYS.map((status, index) => ({
                    name: labels[index],
                    type: 'line',
                    stack: 'total',
                    areaStyle: { opacity: 0.75 },
                    lineStyle: { width: 0 },
                    smooth: false,
                    symbol: 'none',
                    color: STATUS_DISTRIBUTION_COLORS[status],
                    emphasis: { focus: 'series', areaStyle: { opacity: 0.95 } },
                    blur: { areaStyle: { opacity: 0.3 } },
                    data: buckets.map((bucket) => bucket.percentages[status])
                }))
            },
            { notMerge: true }
        );
        const observer = new ResizeObserver(() => chart.resize());
        observer.observe(chartElement.current);
        return () => {
            observer.disconnect();
            chart.dispose();
        };
    }, [buckets, dark, namesKey, error]);

    return (
        <Card className="min-w-0">
            <CardHeader>
                <CardTitle>
                    {t('dialog.user.info.status_distribution')}
                </CardTitle>
                <CardAction>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        disabled={!owner || !profile.id || loading}
                        aria-label={t(
                            'dialog.user.info.refresh_status_distribution'
                        )}
                        title={t(
                            'dialog.user.info.refresh_status_distribution'
                        )}
                        onClick={() => void load()}
                    >
                        {loading ? (
                            <Spinner className="size-3" />
                        ) : (
                            <RefreshCwIcon />
                        )}
                    </Button>
                </CardAction>
            </CardHeader>
            <CardContent className="min-w-0 space-y-3">
                {!loaded && !loading ? (
                    <p className="text-muted-foreground text-xs">
                        {t('dialog.user.info.status_distribution_hint')}
                    </p>
                ) : null}
                {loading ? (
                    <p role="status" className="text-muted-foreground text-xs">
                        {t('dialog.user.loading.loading')}
                    </p>
                ) : null}
                {error ? (
                    <p role="alert" className="text-destructive text-xs">
                        {t('dialog.user.info.status_distribution_error')}
                    </p>
                ) : null}
                {loaded && !error && !buckets.length ? (
                    <p className="text-muted-foreground text-xs">
                        {self
                            ? t(
                                  'dialog.user.status_distribution.insufficient_self_samples',
                                  {
                                      defaultValue:
                                          'Insufficient recorded game-session and status samples.'
                                  }
                              )
                            : t('dialog.user.info.no_status_distribution')}
                    </p>
                ) : null}
                {buckets.length > 0 && !error ? (
                    <>
                        <p className="text-muted-foreground text-xs">
                            {self
                                ? t(
                                      'dialog.user.status_distribution.self_scope',
                                      {
                                          defaultValue:
                                              'Only recorded game-online intervals are counted; this is not total web/account online time.'
                                      }
                                  )
                                : t(
                                      'dialog.user.info.status_distribution_scope'
                                  )}
                        </p>
                        <div className="text-muted-foreground flex items-center justify-end gap-2 text-xs">
                            <ZoomOutIcon className="size-3.5" />
                            <input
                                aria-label={t(
                                    'dialog.user.status_distribution.bucket_scale',
                                    { defaultValue: 'Time bucket size' }
                                )}
                                type="range"
                                min={0}
                                max={100}
                                step={1}
                                value={scale.slider}
                                onChange={(event) =>
                                    scale.setSlider(Number(event.target.value))
                                }
                                className="accent-primary w-28"
                            />
                            <ZoomInIcon className="size-3.5" />
                            <span className="tabular-nums">
                                {scale.bucketDays}{' '}
                                {t(
                                    'dialog.user.status_distribution.days_per_unit',
                                    { defaultValue: 'days/unit' }
                                )}
                            </span>
                        </div>
                        <div
                            ref={chartElement}
                            role="img"
                            aria-label={t(
                                'dialog.user.info.status_distribution'
                            )}
                            className="w-full min-w-0"
                            style={{ height: 280 }}
                        />
                        <dl className="grid grid-cols-2 gap-2 text-xs">
                            {STATUS_DISTRIBUTION_KEYS.map((status, index) => {
                                const seconds = buckets.reduce(
                                    (sum, bucket) =>
                                        sum + bucket.seconds[status],
                                    0
                                );
                                return seconds > 0 ? (
                                    <div key={status}>
                                        <dt>
                                            <span
                                                style={{
                                                    color: STATUS_DISTRIBUTION_COLORS[
                                                        status
                                                    ]
                                                }}
                                            >
                                                ●
                                            </span>{' '}
                                            {names[index]}
                                        </dt>
                                        <dd className="tabular-nums">
                                            {formatStatsDuration(
                                                Math.round(seconds)
                                            )}
                                        </dd>
                                    </div>
                                ) : null;
                            })}
                        </dl>
                    </>
                ) : null}
            </CardContent>
        </Card>
    );
}
