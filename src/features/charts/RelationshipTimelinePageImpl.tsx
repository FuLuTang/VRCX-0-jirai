// @ts-nocheck
import { RefreshCcwIcon, TrendingUpIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
    toLocalDayKey,
    formatDateLabel
} from '@/features/instance-history/instance-activity/instanceActivityDate';
import { getLocalDayBounds } from '@/features/instance-history/instance-activity/instanceActivityRows';
import { formatDateFilter, timeToText } from '@/lib/dateTime';
import feedRepository from '@/repositories/feedRepository';
import { useFriendRosterStore } from '@/state/friendRosterStore';
import { useRuntimeStore } from '@/state/runtimeStore';
import { Button } from '@/ui/shadcn/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/shadcn/card';
import { Spinner } from '@/ui/shadcn/spinner';

import { getHistoryDateMs } from './historyUtils';
import { buildRelationshipSessions } from './relationshipHistory';

function buildFriendOptions(friendsById) {
    return Object.values(friendsById || {})
        .map((friend) => ({
            id: String(friend?.id || friend?.userId || '').trim(),
            label:
                String(friend?.displayName || friend?.username || '').trim() ||
                String(friend?.id || friend?.userId || '').trim()
        }))
        .filter((friend) => friend.id)
        .sort((left, right) => left.label.localeCompare(right.label));
}

function buildSessions(rows) {
    return buildRelationshipSessions(rows).sort(
        (left, right) => left.startMs - right.startMs
    );
}

function doIntervalsOverlap(left, right) {
    return !(left.leaveMs < right.joinMs || right.leaveMs < left.joinMs);
}

function splitDurationByDay(targetMap, startMs, endMs, amountMs) {
    let cursorMs = startMs;
    while (cursorMs < endMs) {
        const dayKey = toLocalDayKey(new Date(cursorMs));
        const { startMs: dayStartMs, endMs: dayEndMs } =
            getLocalDayBounds(dayKey);
        const segmentStartMs = Math.max(cursorMs, dayStartMs);
        const segmentEndMs = Math.min(endMs, dayEndMs + 1);
        const segmentMs = Math.max(0, segmentEndMs - segmentStartMs);
        if (segmentMs > 0) {
            targetMap.set(
                dayKey,
                (targetMap.get(dayKey) || 0) + amountMs(segmentMs)
            );
        }
        cursorMs = dayEndMs + 1;
    }
}

function buildTimelineRows(
    rangeDays,
    currentSessions,
    friendSessions,
    friendStatusRows
) {
    const todayKey = toLocalDayKey(new Date());
    const endDay = getLocalDayBounds(todayKey).endMs;
    const startDay = getLocalDayBounds(
        toLocalDayKey(
            new Date(Date.now() - (rangeDays - 1) * 24 * 60 * 60 * 1000)
        )
    ).startMs;

    const overlapByDay = new Map();
    const statusCountByDay = new Map();

    for (const currentSession of currentSessions) {
        for (const friendSession of friendSessions) {
            if (
                !doIntervalsOverlap(
                    {
                        joinMs: currentSession.startMs,
                        leaveMs: currentSession.endMs
                    },
                    {
                        joinMs: friendSession.startMs,
                        leaveMs: friendSession.endMs
                    }
                )
            ) {
                continue;
            }

            const overlapStartMs = Math.max(
                currentSession.startMs,
                friendSession.startMs
            );
            const overlapEndMs = Math.min(
                currentSession.endMs,
                friendSession.endMs
            );
            if (overlapEndMs <= overlapStartMs) {
                continue;
            }

            splitDurationByDay(
                overlapByDay,
                overlapStartMs,
                overlapEndMs,
                (segmentMs) => segmentMs
            );
        }
    }

    for (const row of friendStatusRows) {
        const dayKey = toLocalDayKey(new Date(getHistoryDateMs(row)));
        if (!dayKey) {
            continue;
        }
        statusCountByDay.set(dayKey, (statusCountByDay.get(dayKey) || 0) + 1);
    }

    const rows = [];
    for (let dayCursorMs = startDay; dayCursorMs <= endDay;) {
        const dayKey = toLocalDayKey(new Date(dayCursorMs));
        rows.push({
            dayKey,
            label: formatDateLabel(dayKey),
            overlapMs: overlapByDay.get(dayKey) || 0,
            statusCount: statusCountByDay.get(dayKey) || 0
        });
        const { endMs: dayEndMs } = getLocalDayBounds(dayKey);
        dayCursorMs = dayEndMs + 1;
    }

    return rows;
}

function HistorySelect({ label, value, options, onChange }) {
    return (
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
            <span className="text-muted-foreground truncate text-xs">
                {label}
            </span>
            <select
                className="border-input bg-background h-10 rounded-md border px-3 text-sm outline-none"
                value={value}
                onChange={(event) => onChange(event.target.value)}
            >
                {options.map((option) => (
                    <option key={option.id} value={option.id}>
                        {option.label}
                    </option>
                ))}
            </select>
        </label>
    );
}

function ChartCard({ title, rows, valueKey, colorClass, formatValue }) {
    const width = 860;
    const height = 220;
    const paddingX = 28;
    const paddingY = 24;
    const maxValue = Math.max(1, ...rows.map((row) => row[valueKey] || 0));
    const points = rows.map((row, index) => {
        const x =
            rows.length <= 1
                ? width / 2
                : paddingX +
                  ((width - paddingX * 2) * index) / (rows.length - 1);
        const y =
            height -
            paddingY -
            ((height - paddingY * 2) * (row[valueKey] || 0)) / maxValue;
        return { x, y, label: row.label, value: row[valueKey] || 0 };
    });

    const path = points.length
        ? `M ${points[0].x} ${points[0].y} ${points
              .slice(1)
              .map((point) => `L ${point.x} ${point.y}`)
              .join(' ')}`
        : '';

    return (
        <Card className="min-w-0">
            <CardHeader>
                <CardTitle className="text-sm">{title}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="text-muted-foreground h-56 w-full min-w-[48rem] overflow-visible"
                    role="img"
                >
                    <line
                        x1={paddingX}
                        y1={height - paddingY}
                        x2={width - paddingX}
                        y2={height - paddingY}
                        stroke="currentColor"
                        strokeOpacity="0.25"
                    />
                    <line
                        x1={paddingX}
                        y1={paddingY}
                        x2={paddingX}
                        y2={height - paddingY}
                        stroke="currentColor"
                        strokeOpacity="0.25"
                    />
                    {path ? (
                        <>
                            <path
                                d={path}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                className={colorClass}
                            />
                            {points.map((point) => (
                                <circle
                                    key={`${point.label}:${point.value}`}
                                    cx={point.x}
                                    cy={point.y}
                                    r="3.5"
                                    className={colorClass}
                                />
                            ))}
                        </>
                    ) : null}
                    {points.map((point, index) => (
                        <text
                            key={point.label}
                            x={point.x}
                            y={height - 8}
                            textAnchor="middle"
                            className="fill-muted-foreground text-[10px]"
                        >
                            {index %
                                Math.max(1, Math.floor(points.length / 8)) ===
                            0
                                ? point.label.slice(5)
                                : ''}
                        </text>
                    ))}
                    {points.length ? (
                        <text
                            x={width - paddingX}
                            y={paddingY - 6}
                            textAnchor="end"
                            className="fill-muted-foreground text-[10px]"
                        >
                            {formatValue(maxValue)}
                        </text>
                    ) : null}
                </svg>
            </CardContent>
        </Card>
    );
}

export function RelationshipTimelinePage() {
    const { t } = useTranslation();
    const currentUserId = useRuntimeStore((state) => state.auth.currentUserId);
    const friendsById = useFriendRosterStore((state) => state.friendsById);

    const friendOptions = useMemo(
        () => buildFriendOptions(friendsById),
        [friendsById]
    );

    const [friendId, setFriendId] = useState('');
    const [rangeDays, setRangeDays] = useState(90);
    const [status, setStatus] = useState('idle');
    const [detail, setDetail] = useState('');
    const [timelineRows, setTimelineRows] = useState([]);

    useEffect(() => {
        if (!friendOptions.length) {
            setFriendId('');
            return;
        }
        if (
            !friendId ||
            !friendOptions.some((friend) => friend.id === friendId)
        ) {
            setFriendId(friendOptions[0].id);
        }
    }, [friendOptions, friendId]);

    useEffect(() => {
        let active = true;

        if (!currentUserId || !friendId) {
            setStatus('idle');
            setTimelineRows([]);
            setDetail('');
            return () => {
                active = false;
            };
        }

        const dateFrom = new Date(
            Date.now() - rangeDays * 24 * 60 * 60 * 1000
        ).toISOString();
        setStatus('running');
        setDetail('Loading the selected friend timeline.');

        Promise.all([
            feedRepository.queryFeedUserHistory({
                userId: currentUserId,
                targetUserId: currentUserId,
                types: ['GPS', 'Offline'],
                dateFrom,
                maxEntries: 2000
            }),
            feedRepository.queryFeedUserHistory({
                userId: currentUserId,
                targetUserId: friendId,
                types: ['GPS', 'Offline'],
                dateFrom,
                maxEntries: 2000
            }),
            feedRepository.queryFeedUserHistory({
                userId: currentUserId,
                targetUserId: friendId,
                types: ['Status'],
                dateFrom,
                maxEntries: 2000
            })
        ])
            .then(([currentRows, friendRows, friendStatusRows]) => {
                if (!active) {
                    return;
                }

                const currentSessions = buildSessions(currentRows);
                const friendSessions = buildSessions(friendRows);
                const nextRows = buildTimelineRows(
                    rangeDays,
                    currentSessions,
                    friendSessions,
                    friendStatusRows
                );
                setTimelineRows(nextRows);
                setStatus('ready');
                setDetail(
                    nextRows.some((row) => row.overlapMs > 0)
                        ? `Computed ${nextRows.filter((row) => row.overlapMs > 0).length} co-presence days in the selected range.`
                        : 'No co-presence overlap found in the selected range.'
                );
            })
            .catch((error) => {
                if (!active) {
                    return;
                }

                setStatus('error');
                setTimelineRows([]);
                setDetail(
                    error instanceof Error
                        ? error.message
                        : 'Failed to load relationship timeline.'
                );
            });

        return () => {
            active = false;
        };
    }, [currentUserId, friendId, rangeDays]);

    const summary = useMemo(() => {
        let totalOverlapMs = 0;
        let activeDays = 0;
        let statusChanges = 0;
        for (const row of timelineRows) {
            totalOverlapMs += row.overlapMs;
            if (row.overlapMs > 0) {
                activeDays += 1;
            }
            statusChanges += row.statusCount;
        }
        return { totalOverlapMs, activeDays, statusChanges };
    }, [timelineRows]);

    return (
        <div className="flex h-full min-h-0 flex-col gap-4 p-4">
            <Card>
                <CardHeader className="gap-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <TrendingUpIcon className="size-4" />
                        {t('view.charts.relationship_timeline.header')}
                    </CardTitle>
                    <div className="flex flex-wrap items-end gap-3">
                        <HistorySelect
                            label={t(
                                'view.charts.relationship_timeline.friend'
                            )}
                            value={friendId}
                            options={friendOptions}
                            onChange={setFriendId}
                        />
                        <label className="flex min-w-0 flex-col gap-1 text-sm">
                            <span className="text-muted-foreground truncate text-xs">
                                {t(
                                    'view.charts.relationship_timeline.range_days'
                                )}
                            </span>
                            <select
                                className="border-input bg-background h-10 rounded-md border px-3 text-sm outline-none"
                                value={rangeDays}
                                onChange={(event) =>
                                    setRangeDays(
                                        Number(event.target.value) || 90
                                    )
                                }
                            >
                                {[30, 60, 90, 180, 365].map((days) => (
                                    <option key={days} value={days}>
                                        {days}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <Button
                            type="button"
                            variant="outline"
                            className="h-10"
                            disabled={!friendOptions.length}
                            onClick={() => setRangeDays((current) => current)}
                        >
                            <RefreshCcwIcon className="mr-2 size-4" />
                            {t('common.actions.refresh')}
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid gap-4 xl:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">
                            {t(
                                'view.charts.relationship_timeline.total_overlap'
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">
                        {timeToText(summary.totalOverlapMs, true)}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">
                            {t('view.charts.relationship_timeline.active_days')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">
                        {summary.activeDays}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">
                            {t(
                                'view.charts.relationship_timeline.status_changes'
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">
                        {summary.statusChanges}
                    </CardContent>
                </Card>
            </div>

            <ChartCard
                title={t('view.charts.relationship_timeline.co_presence_chart')}
                rows={timelineRows}
                valueKey="overlapMs"
                colorClass="stroke-blue-500 fill-blue-500"
                formatValue={(value) => timeToText(value, true)}
            />

            <ChartCard
                title={t('view.charts.relationship_timeline.status_chart')}
                rows={timelineRows}
                valueKey="statusCount"
                colorClass="stroke-orange-500 fill-orange-500"
                formatValue={(value) => `${value}`}
            />

            {status === 'running' ? (
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Spinner className="size-4" />
                    <span>{t('common.loading')}</span>
                </div>
            ) : detail ? (
                <div className="text-muted-foreground px-1 text-sm">
                    {detail}
                </div>
            ) : null}

            {timelineRows.length ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">
                            {t(
                                'view.charts.relationship_timeline.timeline_rows'
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="overflow-auto">
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr className="text-muted-foreground border-b text-left text-xs uppercase">
                                    <th className="py-2 pr-3">
                                        {t('common.time_units.d')}
                                    </th>
                                    <th className="py-2 pr-3">
                                        {t(
                                            'view.charts.relationship_timeline.co_presence_chart'
                                        )}
                                    </th>
                                    <th className="py-2 pr-3">
                                        {t(
                                            'view.charts.relationship_timeline.status_chart'
                                        )}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {timelineRows
                                    .filter(
                                        (row) =>
                                            row.overlapMs > 0 ||
                                            row.statusCount > 0
                                    )
                                    .map((row) => (
                                        <tr
                                            key={row.dayKey}
                                            className="border-b last:border-0"
                                        >
                                            <td className="text-muted-foreground py-2 pr-3 text-xs">
                                                {row.label}
                                            </td>
                                            <td className="py-2 pr-3 font-medium">
                                                {timeToText(
                                                    row.overlapMs,
                                                    true
                                                )}
                                            </td>
                                            <td className="py-2 pr-3 font-medium">
                                                {row.statusCount}
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            ) : null}
        </div>
    );
}
