import type { EChartsType } from 'echarts/core';
import {
    InfoIcon,
    RefreshCcwIcon,
    TrendingUpIcon,
    ZoomInIcon,
    ZoomOutIcon
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
    PageScaffold,
    PageTitle,
    PageToolbar
} from '@/components/layout/PageScaffold';
import { echarts } from '@/lib/echarts';
import feedRepository from '@/repositories/feedRepository';
import { getResolvedThemeMode } from '@/services/themeService';
import { useFriendRosterStore } from '@/state/friendRosterStore';
import { useRuntimeStore } from '@/state/runtimeStore';
import { useShellStore } from '@/state/shellStore';
import { Button } from '@/ui/shadcn/button';
import { Checkbox } from '@/ui/shadcn/checkbox';
import { Label } from '@/ui/shadcn/label';
import { Slider } from '@/ui/shadcn/slider';
import { Spinner } from '@/ui/shadcn/spinner';

import {
    buildRelationshipDailyValues,
    buildRelationshipSessions,
    buildRelationshipTimeline,
    initialRelationshipTimelineZoom
} from './relationshipHistory';

const COLORS = [
    '#5470c6',
    '#91cc75',
    '#fac858',
    '#ee6666',
    '#73c0de',
    '#3ba272',
    '#fc8452',
    '#9a60b4',
    '#ea7ccc',
    '#17c0ac'
];

function bucketDaysFromSlider(value: number) {
    return Math.max(1, Math.round(90 ** (value / 100)));
}

function escapeTooltipHtml(value: unknown) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => {
        const entities: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return entities[character];
    });
}

function relationshipChartOption(
    data: ReturnType<typeof buildRelationshipTimeline>,
    start: number,
    end: number,
    t: (key: string, options?: { defaultValue?: string }) => string
) {
    return {
        backgroundColor: 'transparent',
        animation: false,
        color: COLORS,
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'line' },
            formatter(params: unknown) {
                if (!Array.isArray(params)) {
                    return '';
                }
                const items = params as Array<{
                    value: unknown;
                    axisValueLabel?: unknown;
                    axisValue?: unknown;
                    color?: unknown;
                    seriesName?: unknown;
                }>;
                const visible = items
                    .filter((parameter) => Number(parameter.value) > 0)
                    .sort(
                        (left, right) =>
                            Number(right.value) - Number(left.value)
                    );
                if (!visible.length) {
                    return '';
                }

                const date = escapeTooltipHtml(
                    visible[0].axisValueLabel || visible[0].axisValue
                );
                const rows = visible
                    .map((parameter) => {
                        const color = escapeTooltipHtml(parameter.color);
                        const name = escapeTooltipHtml(parameter.seriesName);
                        const value = Number(parameter.value).toFixed(1);
                        return (
                            '<div style="display:flex;align-items:center;gap:6px;padding:2px 4px">' +
                            `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0"></span>` +
                            `<span style="flex:1;font-size:12px">${name}</span>` +
                            `<span style="font-size:12px;font-weight:600">${value}%</span>` +
                            '</div>'
                        );
                    })
                    .join('');

                return (
                    `<div style="margin-bottom:6px;font-weight:600;font-size:12px">${date}</div>` +
                    rows
                );
            }
        },
        legend: {
            top: 0,
            type: 'scroll',
            height: 64,
            data: data.series.map((series) => series.name)
        },
        grid: { left: 48, right: 24, top: 78, bottom: 78, containLabel: true },
        xAxis: {
            type: 'category',
            data: data.labels,
            boundaryGap: false,
            axisLabel: { rotate: 30, fontSize: 10, hideOverlap: true }
        },
        yAxis: {
            type: 'value',
            min: 0,
            max: 100,
            axisLabel: { formatter: '{value}%' }
        },
        dataZoom: [
            {
                type: 'slider',
                xAxisIndex: 0,
                start,
                end,
                bottom: 8,
                height: 20
            },
            { type: 'inside', xAxisIndex: 0, start, end }
        ],
        series: data.series.map((series) => ({
            name: series.name,
            type: 'line',
            stack: 'relationship-share',
            areaStyle: { opacity: 0.72 },
            lineStyle: { width: 0 },
            smooth: false,
            symbol: 'none',
            color: series.id === 'others' ? '#aaaaaa' : series.color,
            emphasis: { focus: 'series', areaStyle: { opacity: 0.95 } },
            blur: {
                itemStyle: { opacity: 0.35 },
                lineStyle: { opacity: 0.35 }
            },
            data: series.values
        })),
        aria: { enabled: true, decal: { show: false } },
        graphic: data.series.length
            ? undefined
            : [
                  {
                      type: 'text',
                      left: 'center',
                      top: 'middle',
                      style: {
                          text: t('view.charts.relationship_timeline.no_data', {
                              defaultValue: 'No relationship history found'
                          }),
                          fill: '#888',
                          fontSize: 14
                      }
                  }
              ]
    };
}

export function RelationshipTimelinePage() {
    const { t } = useTranslation();
    const currentUserId = useRuntimeStore((state) => state.auth.currentUserId);
    const friendsById = useFriendRosterStore((state) => state.friendsById);
    const themeMode = useShellStore((state) => state.themeMode);
    const resolvedTheme = getResolvedThemeMode(themeMode);
    const [rows, setRows] = useState<
        Awaited<
            ReturnType<typeof feedRepository.queryRelationshipTimelineHistory>
        >
    >([]);
    const [status, setStatus] = useState<
        'idle' | 'loading' | 'ready' | 'error'
    >('idle');
    const [refreshVersion, setRefreshVersion] = useState(0);
    const [topCount, setTopCount] = useState(5);
    const [scale, setScale] = useState(53);
    const [settledTopCount, setSettledTopCount] = useState(5);
    const [settledScale, setSettledScale] = useState(53);
    const [showOthers, setShowOthers] = useState(false);
    const [friendsOnly, setFriendsOnly] = useState(false);
    const [settledShowOthers, setSettledShowOthers] = useState(false);
    const [settledFriendsOnly, setSettledFriendsOnly] = useState(false);
    const chartElementRef = useRef<HTMLDivElement | null>(null);
    const chartRef = useRef<EChartsType | null>(null);
    const zoomRef = useRef<{ start: number; end: number } | null>(null);
    const bucketDays = bucketDaysFromSlider(scale);
    const settledBucketDays = bucketDaysFromSlider(settledScale);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            setSettledTopCount(topCount);
            setSettledScale(scale);
            setSettledShowOthers(showOthers);
            setSettledFriendsOnly(friendsOnly);
        }, 1000);

        return () => window.clearTimeout(timeout);
    }, [friendsOnly, scale, showOthers, topCount]);

    useEffect(() => {
        let active = true;
        if (!currentUserId) {
            setRows([]);
            setStatus('idle');
            return () => {
                active = false;
            };
        }

        setStatus('loading');
        void feedRepository
            .queryRelationshipTimelineHistory(currentUserId)
            .then((result) => {
                if (active) {
                    setRows(result);
                    setStatus('ready');
                }
            })
            .catch((error: unknown) => {
                if (!active) {
                    return;
                }
                console.error(
                    '[RelationshipTimeline] Failed to load history',
                    error
                );
                setRows([]);
                setStatus('error');
            });

        return () => {
            active = false;
        };
    }, [currentUserId, refreshVersion]);

    const timeline = useMemo(() => {
        const sessions = buildRelationshipSessions(rows).filter(
            (session) => session.userId !== currentUserId
        );
        let dailyValues = buildRelationshipDailyValues(sessions);
        if (settledFriendsOnly) {
            dailyValues = dailyValues.filter((value) =>
                Object.prototype.hasOwnProperty.call(friendsById, value.userId)
            );
        }
        return buildRelationshipTimeline(
            dailyValues,
            settledBucketDays,
            settledTopCount,
            settledShowOthers,
            (userId, fallback) =>
                String(
                    friendsById[userId]?.displayName ||
                        friendsById[userId]?.username ||
                        fallback ||
                        userId
                )
        );
    }, [
        currentUserId,
        friendsById,
        rows,
        settledBucketDays,
        settledFriendsOnly,
        settledShowOthers,
        settledTopCount
    ]);

    useEffect(() => {
        const element = chartElementRef.current;
        if (!element) {
            return;
        }

        const theme = resolvedTheme === 'dark' ? 'dark' : undefined;
        const chart = echarts.init(element, theme);
        chartRef.current = chart;
        const resizeObserver = new ResizeObserver(() => chart.resize());
        resizeObserver.observe(element);
        const handleZoom = (payload: unknown) => {
            const event = payload as {
                start?: number;
                end?: number;
                batch?: Array<{ start?: number; end?: number }>;
            };
            const range = event.batch?.[0] || event;
            if (Number.isFinite(range.start) && Number.isFinite(range.end)) {
                zoomRef.current = {
                    start: range.start as number,
                    end: range.end as number
                };
            }
        };
        chart.on('datazoom', handleZoom);

        return () => {
            chart.off('datazoom', handleZoom);
            resizeObserver.disconnect();
            chart.dispose();
            if (chartRef.current === chart) {
                chartRef.current = null;
            }
        };
    }, [resolvedTheme]);

    useEffect(() => {
        const chart = chartRef.current;
        if (!chart) {
            return;
        }
        const defaultZoom = initialRelationshipTimelineZoom(
            timeline.labels.length
        );
        const zoom = zoomRef.current || defaultZoom;
        chart.setOption(
            relationshipChartOption(timeline, zoom.start, zoom.end, t),
            { notMerge: true }
        );
    }, [resolvedTheme, timeline, t]);

    return (
        <PageScaffold id="chart" className="gap-3">
            <PageToolbar className="flex-row flex-wrap items-center justify-between gap-x-6 gap-y-3">
                <div className="flex min-w-0 items-center gap-2">
                    <TrendingUpIcon className="size-4 shrink-0" />
                    <PageTitle>
                        {t('view.charts.relationship_timeline.header')}
                    </PageTitle>
                    <span
                        title={t(
                            'view.charts.relationship_timeline.description',
                            {
                                defaultValue:
                                    'Share of recorded time spent in the same instance, grouped into time buckets.'
                            }
                        )}
                    >
                        <InfoIcon className="text-muted-foreground size-3.5" />
                    </span>
                </div>
                <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-x-5 gap-y-2 text-sm">
                    <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
                        <span id="relationship-timeline-top-users">
                            {t('view.charts.relationship_timeline.top_users', {
                                defaultValue: 'Top users'
                            })}
                        </span>
                        <div className="w-24 shrink-0">
                            <Slider
                                aria-labelledby="relationship-timeline-top-users"
                                className="w-full"
                                min={1}
                                max={10}
                                step={1}
                                value={[topCount]}
                                onValueChange={(value) =>
                                    setTopCount(
                                        Array.isArray(value) ? value[0] : value
                                    )
                                }
                            />
                        </div>
                        <span className="w-4 text-right tabular-nums">
                            {topCount}
                        </span>
                    </div>
                    <Label className="shrink-0 whitespace-nowrap">
                        <Checkbox
                            checked={showOthers}
                            onCheckedChange={setShowOthers}
                        />
                        {t('view.charts.relationship_timeline.show_others', {
                            defaultValue: 'Show others'
                        })}
                    </Label>
                    <Label className="shrink-0 whitespace-nowrap">
                        <Checkbox
                            checked={friendsOnly}
                            onCheckedChange={setFriendsOnly}
                        />
                        {t(
                            'view.charts.relationship_timeline.current_friends_only',
                            { defaultValue: 'Current friends only' }
                        )}
                    </Label>
                    <Button
                        aria-label={t('common.actions.refresh')}
                        title={t('common.actions.refresh')}
                        type="button"
                        size="icon"
                        variant="outline"
                        className="shrink-0"
                        disabled={status === 'loading' || !currentUserId}
                        onClick={() =>
                            setRefreshVersion((version) => version + 1)
                        }
                    >
                        <RefreshCcwIcon
                            className={`size-4 ${status === 'loading' ? 'animate-spin' : ''}`}
                        />
                    </Button>
                </div>
            </PageToolbar>

            <div className="relative min-h-0 flex-1">
                <div
                    ref={chartElementRef}
                    className="h-full min-h-72 w-full"
                    role="img"
                    aria-label={t(
                        'view.charts.relationship_timeline.chart_aria_label',
                        {
                            defaultValue:
                                'Relationship share over time stacked area chart'
                        }
                    )}
                />
                {status === 'loading' ? (
                    <div className="text-muted-foreground absolute inset-0 flex items-center justify-center gap-2 text-sm">
                        <Spinner className="size-4" />
                        {t('common.loading')}
                    </div>
                ) : null}
                {status === 'idle' ? (
                    <div className="text-muted-foreground absolute inset-0 flex items-center justify-center text-sm">
                        {t(
                            'view.charts.relationship_timeline.sign_in_required',
                            {
                                defaultValue:
                                    'Sign in to view relationship history.'
                            }
                        )}
                    </div>
                ) : null}
                {status === 'error' ? (
                    <div className="text-destructive absolute inset-x-4 bottom-10 text-center text-sm">
                        {t('view.charts.relationship_timeline.load_failed', {
                            defaultValue:
                                'Relationship history failed to load. Try refreshing.'
                        })}
                    </div>
                ) : null}
            </div>

            <div className="text-muted-foreground flex shrink-0 items-center justify-end gap-2 px-3 text-xs">
                <ZoomOutIcon className="size-3.5" />
                <span
                    id="relationship-timeline-granularity"
                    className="sr-only"
                >
                    {t('view.charts.relationship_timeline.granularity', {
                        defaultValue: 'Days per unit'
                    })}
                </span>
                <Slider
                    aria-labelledby="relationship-timeline-granularity"
                    className="w-28"
                    min={0}
                    max={100}
                    step={1}
                    value={[scale]}
                    onValueChange={(value) =>
                        setScale(Array.isArray(value) ? value[0] : value)
                    }
                />
                <ZoomInIcon className="size-3.5" />
                <span className="min-w-20 text-right tabular-nums">
                    {bucketDays}{' '}
                    {t('view.charts.relationship_timeline.days_per_unit', {
                        defaultValue: 'days/unit'
                    })}
                </span>
            </div>
        </PageScaffold>
    );
}
