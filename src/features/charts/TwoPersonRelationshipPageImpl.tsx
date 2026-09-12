// @ts-nocheck
import {
    ArrowLeftRightIcon,
    ClockIcon,
    CrownIcon,
    HashIcon,
    InfoIcon,
    RefreshCcwIcon,
    UsersIcon
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Location } from '@/components/Location';
import { formatDateTime, timeToText } from '@/lib/dateTime';
import feedRepository from '@/repositories/feedRepository';
import { openWorldDialog } from '@/services/dialogService';
import { parseLocation } from '@/shared/utils/location';
import { useFriendRosterStore } from '@/state/friendRosterStore';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useRuntimeStore } from '@/state/runtimeStore';
import { Button } from '@/ui/shadcn/button';
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger
} from '@/ui/shadcn/hover-card';
import { Switch } from '@/ui/shadcn/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/shadcn/tooltip';

import { buildRelationshipSessions } from './relationshipHistory';

const THREE_MINUTES_MS = 3 * 60 * 1000;

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

function buildSessions(rows, userId, label) {
    return buildRelationshipSessions(rows)
        .filter((session) => session.userId === userId)
        .map((session) => ({ ...session, label }))
        .sort((left, right) => left.startMs - right.startMs);
}

function getOverlapRows(leftSessions, rightSessions) {
    const overlapRows = [];

    for (const left of leftSessions) {
        for (const right of rightSessions) {
            if (left.location !== right.location) {
                continue;
            }

            const startMs = Math.max(left.startMs, right.startMs);
            const endMs = Math.min(left.endMs, right.endMs);
            if (endMs <= startMs) {
                continue;
            }

            overlapRows.push({
                location: left.location,
                worldName: left.worldName || right.worldName || '',
                startMs,
                endMs,
                overlapMs: endMs - startMs,
                leftStartMs: left.startMs,
                leftEndMs: left.endMs,
                rightStartMs: right.startMs,
                rightEndMs: right.endMs
            });
        }
    }

    return overlapRows.sort((left, right) => right.overlapMs - left.overlapMs);
}

function buildSelfSessions(rows, userId) {
    return buildRelationshipSessions(rows)
        .filter((session) => session.userId === userId)
        .map(({ location, startMs, endMs }) => ({ location, startMs, endMs }));
}

function isSelfPresent(
    selfSessionsByLocation,
    location,
    overlapStart,
    overlapEnd
) {
    const sessions = selfSessionsByLocation[location];
    if (!sessions?.length) return false;
    for (const session of sessions) {
        if (session.startMs < overlapEnd && session.endMs > overlapStart) {
            return true;
        }
    }
    return false;
}

function groupOverlapsByLocation(overlapRows, selfSessions, dtHour12) {
    const grouped = new Map();

    const selfSessionsByLocation = {};
    for (const session of selfSessions) {
        (selfSessionsByLocation[session.location] ??= []).push(session);
    }

    for (const row of overlapRows) {
        const key = row.location;
        if (!grouped.has(key)) {
            const parsed = parseLocation(row.location);
            const instanceCreatorId = parsed?.userId || null;

            grouped.set(key, {
                location: row.location,
                worldName: row.worldName,
                coexistenceTime: 0,
                joinLeavesCount: 0,
                earliestStartMs: Infinity,
                latestStartMs: 0,
                firstLeftJoinMs: row.leftStartMs,
                firstRightJoinMs: row.rightStartMs
            });
        }

        const item = grouped.get(key);
        item.coexistenceTime += row.overlapMs;
        item.joinLeavesCount += 1;
        item.earliestStartMs = Math.min(item.earliestStartMs, row.startMs);
        if (row.startMs > item.latestStartMs) {
            item.latestStartMs = row.startMs;
        }
        if (row.leftStartMs < item.firstLeftJoinMs) {
            item.firstLeftJoinMs = row.leftStartMs;
        }
        if (row.rightStartMs < item.firstRightJoinMs) {
            item.firstRightJoinMs = row.rightStartMs;
        }
    }

    const results = [];
    for (const item of grouped.values()) {
        const startDiffMs = Math.abs(
            item.firstLeftJoinMs - item.firstRightJoinMs
        );
        let initiator = 'mutual';
        if (startDiffMs > THREE_MINUTES_MS) {
            initiator =
                item.firstLeftJoinMs > item.firstRightJoinMs
                    ? 'leftPlayer'
                    : 'rightPlayer';
        }

        const selfPresent = isSelfPresent(
            selfSessionsByLocation,
            item.location,
            item.earliestStartMs,
            item.earliestStartMs + 60000
        );

        const parsed = parseLocation(item.location);
        const instanceCreatorId = parsed?.userId || null;

        results.push({
            location: item.location,
            worldName: item.worldName,
            coexistenceTime: item.coexistenceTime,
            joinLeavesCount: item.joinLeavesCount,
            formattedDate: formatDateTime(item.latestStartMs, {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            }),
            initiator,
            selfPresent,
            instanceCreatorId
        });
    }

    return results.sort((a, b) => b.latestStartMs - a.latestStartMs);
}

function computeTotalTime(groupedItems) {
    return groupedItems.reduce((acc, item) => acc + item.coexistenceTime, 0);
}

export function TwoPersonRelationshipPage() {
    const { t } = useTranslation();
    const currentUserId = useRuntimeStore((state) => state.auth.currentUserId);
    const friendsById = useFriendRosterStore((state) => state.friendsById);
    const dtHour12 = usePreferencesStore((state) => state.dtHour12);

    const friendOptions = useMemo(
        () => buildFriendOptions(friendsById),
        [friendsById]
    );

    const [leftUserId, setLeftUserId] = useState('');
    const [rightUserId, setRightUserId] = useState('');
    const [status, setStatus] = useState('idle');
    const [detail, setDetail] = useState('');
    const [overlapRows, setOverlapRows] = useState([]);
    const [selfSessions, setSelfSessions] = useState([]);
    const [showSelfPresence, setShowSelfPresence] = useState(false);

    useEffect(() => {
        if (!friendOptions.length) {
            setLeftUserId('');
            setRightUserId('');
            return;
        }

        if (
            !leftUserId ||
            !friendOptions.some((friend) => friend.id === leftUserId)
        ) {
            setLeftUserId(friendOptions[0].id);
        }

        const nextRight =
            friendOptions.find((friend) => friend.id !== leftUserId) ||
            friendOptions[1] ||
            friendOptions[0];
        if (
            !rightUserId ||
            !friendOptions.some((friend) => friend.id === rightUserId) ||
            rightUserId === leftUserId
        ) {
            setRightUserId(nextRight?.id || '');
        }
    }, [friendOptions, leftUserId, rightUserId]);

    useEffect(() => {
        let active = true;

        if (
            !currentUserId ||
            !leftUserId ||
            !rightUserId ||
            leftUserId === rightUserId
        ) {
            setStatus('idle');
            setOverlapRows([]);
            setSelfSessions([]);
            setDetail('');
            return () => {
                active = false;
            };
        }

        setStatus('running');
        setDetail(t('view.charts.two_person_relationship.status.loading'));

        const queries = [
            feedRepository.queryFeedUserHistory({
                userId: currentUserId,
                targetUserId: leftUserId,
                types: ['GPS', 'Offline'],
                maxEntries: 50000
            }),
            feedRepository.queryFeedUserHistory({
                userId: currentUserId,
                targetUserId: rightUserId,
                types: ['GPS', 'Offline'],
                maxEntries: 50000
            })
        ];

        Promise.all(queries)
            .then(([leftRows, rightRows]) => {
                if (!active) return;

                const leftLabel =
                    friendOptions.find((friend) => friend.id === leftUserId)
                        ?.label || leftUserId;
                const rightLabel =
                    friendOptions.find((friend) => friend.id === rightUserId)
                        ?.label || rightUserId;
                const leftSessions = buildSessions(
                    leftRows,
                    leftUserId,
                    leftLabel
                );
                const rightSessions = buildSessions(
                    rightRows,
                    rightUserId,
                    rightLabel
                );
                const nextOverlapRows = getOverlapRows(
                    leftSessions,
                    rightSessions
                );

                setOverlapRows(nextOverlapRows);
                setSelfSessions([]);
                setStatus('ready');
                setDetail(
                    nextOverlapRows.length
                        ? ''
                        : t(
                              'view.charts.two_person_relationship.status.no_data'
                          )
                );
            })
            .catch((error) => {
                if (!active) return;

                setStatus('error');
                setOverlapRows([]);
                setSelfSessions([]);
                setDetail(
                    error instanceof Error
                        ? error.message
                        : t('view.charts.two_person_relationship.status.error')
                );
            });

        return () => {
            active = false;
        };
    }, [currentUserId, friendOptions, leftUserId, rightUserId, t]);

    useEffect(() => {
        if (!showSelfPresence || !currentUserId || !overlapRows.length) {
            setSelfSessions([]);
            return;
        }

        let active = true;
        feedRepository
            .queryFeedUserHistory({
                userId: currentUserId,
                targetUserId: currentUserId,
                types: ['GPS', 'Offline'],
                maxEntries: 50000
            })
            .then((rows) => {
                if (!active) return;
                const sessions = buildSelfSessions(rows, currentUserId);
                setSelfSessions(sessions);
            })
            .catch(() => {
                if (!active) return;
                setSelfSessions([]);
            });

        return () => {
            active = false;
        };
    }, [showSelfPresence, currentUserId, overlapRows.length]);

    const groupedItems = useMemo(
        () => groupOverlapsByLocation(overlapRows, selfSessions, dtHour12),
        [overlapRows, selfSessions, dtHour12]
    );

    const totalCoexistenceTime = useMemo(
        () => computeTotalTime(groupedItems),
        [groupedItems]
    );

    const hasBothSelected = Boolean(
        leftUserId && rightUserId && leftUserId !== rightUserId
    );

    function handleFriendASelect(friendId) {
        setLeftUserId(friendId);
        setOverlapRows([]);
    }

    function handleFriendBSelect(friendId) {
        setRightUserId(friendId);
        setOverlapRows([]);
    }

    function swapFriends() {
        const tmp = leftUserId;
        setLeftUserId(rightUserId);
        setRightUserId(tmp);
        setOverlapRows([]);
    }

    function openInstance(location) {
        if (!location) return;
        const parsed = parseLocation(location);
        const worldId = parsed?.tag || parsed?.worldId || location;
        openWorldDialog({ worldId });
    }

    function resolveCreatorName(creatorId) {
        if (!creatorId) return null;
        const friend = friendsById[creatorId];
        return friend?.displayName || creatorId;
    }

    return (
        <div
            id="chart"
            className="x-container flex h-full min-h-0 flex-col overflow-y-auto p-6"
        >
            <div className="pt-12">
                <div className="options-container mt-0 flex items-center gap-2">
                    <div className="flex items-center gap-2">
                        <span className="shrink-0">
                            {t('view.charts.two_person_relationship.header')}
                        </span>
                        <HoverCard>
                            <HoverCardTrigger asChild>
                                <InfoIcon className="ml-1 size-3.5 cursor-help opacity-70" />
                            </HoverCardTrigger>
                            <HoverCardContent
                                side="bottom"
                                align="start"
                                className="w-80"
                            >
                                <div className="text-xs">
                                    {t(
                                        'view.charts.two_person_relationship.tips.description'
                                    )}
                                </div>
                            </HoverCardContent>
                        </HoverCard>
                    </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                        <select
                            className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm outline-none"
                            value={leftUserId}
                            onChange={(e) =>
                                handleFriendASelect(e.target.value)
                            }
                        >
                            {!leftUserId && (
                                <option value="" disabled>
                                    {t(
                                        'view.charts.two_person_relationship.select_friend_a'
                                    )}
                                </option>
                            )}
                            {friendOptions
                                .filter((f) => f.id !== rightUserId)
                                .map((opt) => (
                                    <option key={opt.id} value={opt.id}>
                                        {opt.label}
                                    </option>
                                ))}
                        </select>
                    </div>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="shrink-0 rounded-full"
                                disabled={!leftUserId && !rightUserId}
                                onClick={swapFriends}
                            >
                                <ArrowLeftRightIcon className="size-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            {t(
                                'view.charts.two_person_relationship.swap_friends'
                            )}
                        </TooltipContent>
                    </Tooltip>

                    <div className="min-w-0 flex-1">
                        <select
                            className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm outline-none"
                            value={rightUserId}
                            onChange={(e) =>
                                handleFriendBSelect(e.target.value)
                            }
                        >
                            {!rightUserId && (
                                <option value="" disabled>
                                    {t(
                                        'view.charts.two_person_relationship.select_friend_b'
                                    )}
                                </option>
                            )}
                            {friendOptions
                                .filter((f) => f.id !== leftUserId)
                                .map((opt) => (
                                    <option key={opt.id} value={opt.id}>
                                        {opt.label}
                                    </option>
                                ))}
                        </select>
                    </div>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="shrink-0 rounded-full"
                                disabled={
                                    !hasBothSelected || status === 'running'
                                }
                                onClick={() => {
                                    setOverlapRows([]);
                                    setSelfSessions([]);
                                    setStatus('idle');
                                }}
                            >
                                <RefreshCcwIcon
                                    className={[
                                        'size-4',
                                        status === 'running'
                                            ? 'animate-spin'
                                            : ''
                                    ]
                                        .filter(Boolean)
                                        .join(' ')}
                                />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            {t('common.actions.refresh')}
                        </TooltipContent>
                    </Tooltip>

                    <div className="ml-auto flex shrink-0 items-center gap-2 px-0.5">
                        <span className="shrink-0 text-sm">
                            {t(
                                'view.charts.two_person_relationship.show_self_presence'
                            )}
                        </span>
                        <Switch
                            checked={showSelfPresence}
                            onCheckedChange={setShowSelfPresence}
                        />
                    </div>
                </div>

                {status === 'running' ? (
                    <div className="mt-[100px] flex items-center justify-center">
                        <RefreshCcwIcon className="text-muted-foreground size-6 animate-spin" />
                    </div>
                ) : !hasBothSelected ? (
                    <div className="text-muted-foreground mt-[100px] flex flex-col items-center justify-center gap-2">
                        <UsersIcon className="size-12 opacity-20" />
                        <p>
                            {t(
                                'view.charts.two_person_relationship.no_friend_selected'
                            )}
                        </p>
                    </div>
                ) : groupedItems.length === 0 && status === 'ready' ? (
                    <div className="text-muted-foreground mt-[100px] flex flex-col items-center justify-center gap-2">
                        <p>
                            {t(
                                'view.charts.two_person_relationship.status.no_data'
                            )}
                        </p>
                    </div>
                ) : null}

                {groupedItems.length > 0 ? (
                    <>
                        <div className="mx-auto mt-3 flex max-w-[900px] items-center gap-3">
                            <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                                <ClockIcon className="text-muted-foreground size-3.5" />
                                <span className="text-sm font-medium">
                                    {timeToText(totalCoexistenceTime, true)}
                                </span>
                                <span className="text-muted-foreground text-xs">
                                    {t(
                                        'view.charts.two_person_relationship.total_coexistence_time'
                                    )}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                                <HashIcon className="text-muted-foreground size-3.5" />
                                <span className="text-sm font-medium">
                                    {groupedItems.length}
                                </span>
                                <span className="text-muted-foreground text-xs">
                                    {t(
                                        'view.charts.two_person_relationship.instance_count'
                                    )}
                                </span>
                            </div>
                        </div>

                        <div className="mx-auto mt-3 flex max-w-[900px] flex-col gap-3 pb-8">
                            {groupedItems.map((item) => (
                                <button
                                    key={item.location}
                                    type="button"
                                    className="group hover:bg-accent flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all hover:shadow-sm"
                                    onClick={() => openInstance(item.location)}
                                >
                                    <div className="text-muted-foreground w-32 shrink-0 text-xs tabular-nums">
                                        {item.formattedDate}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <Location location={item.location} />
                                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                            {item.instanceCreatorId ? (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className="text-muted-foreground flex items-center gap-1 text-xs">
                                                            <CrownIcon className="size-3 shrink-0" />
                                                            <span className="max-w-[120px] truncate">
                                                                {resolveCreatorName(
                                                                    item.instanceCreatorId
                                                                )}
                                                            </span>
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top">
                                                        {t(
                                                            'view.charts.two_person_relationship.instance_creator'
                                                        )}
                                                    </TooltipContent>
                                                </Tooltip>
                                            ) : null}
                                        </div>
                                    </div>

                                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                                        <div className="text-muted-foreground mr-1 flex items-center gap-1.5 text-xs">
                                            {item.joinLeavesCount > 1 ? (
                                                <span className="bg-muted rounded px-1.5 py-0.5 text-[10px] leading-none tabular-nums opacity-80">
                                                    {t(
                                                        'view.charts.two_person_relationship.meet_count',
                                                        {
                                                            count: item.joinLeavesCount
                                                        }
                                                    )}
                                                </span>
                                            ) : null}
                                            <ClockIcon className="size-3 shrink-0" />
                                            <span className="font-medium tabular-nums">
                                                {timeToText(
                                                    item.coexistenceTime,
                                                    true
                                                )}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {showSelfPresence ? (
                                                <span
                                                    className={[
                                                        'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium leading-none',
                                                        item.selfPresent
                                                            ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                                                            : 'bg-red-500/15 text-red-600 dark:text-red-400'
                                                    ].join(' ')}
                                                >
                                                    {item.selfPresent
                                                        ? t(
                                                              'view.charts.two_person_relationship.self_present'
                                                          )
                                                        : t(
                                                              'view.charts.two_person_relationship.self_not_present'
                                                          )}
                                                </span>
                                            ) : null}
                                            <span
                                                className={[
                                                    'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium leading-none',
                                                    item.initiator === 'mutual'
                                                        ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                                                        : item.initiator ===
                                                            'unknown'
                                                          ? 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800'
                                                          : 'text-orange-600 dark:text-orange-400'
                                                ].join(' ')}
                                                style={
                                                    item.initiator ===
                                                    'leftPlayer'
                                                        ? {
                                                              background:
                                                                  'linear-gradient(to right, rgb(249 115 22 / 0.3), rgb(249 115 22 / 0))'
                                                          }
                                                        : item.initiator ===
                                                            'rightPlayer'
                                                          ? {
                                                                background:
                                                                    'linear-gradient(to left, rgb(249 115 22 / 0.3), rgb(249 115 22 / 0))'
                                                            }
                                                          : {}
                                                }
                                            >
                                                {t(
                                                    'view.charts.two_person_relationship.initiator_' +
                                                        item.initiator
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </>
                ) : null}

                {status !== 'running' && detail ? (
                    <div className="text-muted-foreground px-1 text-sm">
                        {detail}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
