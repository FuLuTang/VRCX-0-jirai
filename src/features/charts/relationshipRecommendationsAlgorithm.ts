import { parseLocation } from '@/shared/utils/location';

// Direct port of VRCX-jirai/src/stores/manualRelations.js::computeSuggestions.
// Keep scoring, thresholds, location aggregation and stable score ordering unchanged.
export type CandidateSession = {
    userId: string;
    leaveAt: number;
    time: number;
};
export type RelationshipSuggestion = {
    userIdA: string;
    userIdB: string;
    nameA: string;
    nameB: string;
    score: number;
    displayScore: string;
    tooltip: string;
    key: string;
    isAdded: boolean;
};
export type RecommendationInput = {
    eventsByLocation: Map<string, CandidateSession[]>;
    mySessions: Map<string, { leaveAt: number; time: number }[]>;
    oldMutualSnapshot: Map<string, Set<string>>;
    friendIds: string[];
    trackedIds: string[];
    names: Map<string, string>;
    manualLinks: { userIdA: string; userIdB: string }[];
    signal?: AbortSignal;
    onProgress?: (progress: {
        done: number;
        total: number;
        step: string;
    }) => void;
};
type PairStats = {
    count: number;
    weightedCount: number;
    countMeAbsent: number;
    countUnknown: number;
    hardMatch: boolean;
    hostedByA: boolean;
    hostedByB: boolean;
    firstMeeting: number;
    lastMeeting: number;
};
type LocationPair = {
    hardMatch: boolean;
    mePresent: boolean;
    accessType: string;
    creatorId: string | null;
    overlapStart: number;
    overlapEnd: number;
    aJoin: number;
    bJoin: number;
};
function localDate(ms: number) {
    const date = new Date(ms);
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
    ].join('-');
}
export async function computeRelationshipSuggestions(
    input: RecommendationInput
): Promise<RelationshipSuggestion[]> {
    input.signal?.throwIfAborted();
    const { eventsByLocation, mySessions, oldMutualSnapshot } = input;
    const myFriendsSet = new Set(input.friendIds);
    const trackedSet = new Set(input.trackedIds);
    const candidatesSet = new Set([...myFriendsSet, ...trackedSet]);

    const pairStats = new Map<string, PairStats>();

    for (const [location, sessions] of eventsByLocation.entries()) {
        input.signal?.throwIfAborted();
        const parsed = parseLocation(location);
        const creatorId = parsed.userId;

        const mySess = mySessions.get(location) || [];
        const P = sessions.length;
        const locPairs = new Map<string, LocationPair>();

        for (let i = 0; i < P; i++) {
            const sessA = sessions[i];
            if (!candidatesSet.has(sessA.userId)) continue;

            for (let j = i + 1; j < P; j++) {
                const sessB = sessions[j];
                if (!candidatesSet.has(sessB.userId)) continue;
                if (sessA.userId === sessB.userId) continue;

                const overlapStart = Math.max(
                    sessA.leaveAt - sessA.time,
                    sessB.leaveAt - sessB.time
                );
                const overlapEnd = Math.min(sessA.leaveAt, sessB.leaveAt);

                if (overlapEnd > overlapStart) {
                    const [id1, id2] = [sessA.userId, sessB.userId].sort();
                    const key = `${id1}|${id2}`;

                    const isStrictPrivate =
                        parsed.accessType === 'invite' ||
                        parsed.accessType === 'private';
                    let hardMatch = false;
                    if (
                        isStrictPrivate &&
                        (creatorId === id1 || creatorId === id2)
                    ) {
                        hardMatch = true;
                    }

                    let mePresent = false;
                    for (const m of mySess) {
                        const myStart = m.leaveAt - m.time;
                        const myEnd = m.leaveAt;
                        if (
                            Math.min(myEnd, overlapEnd) -
                                Math.max(myStart, overlapStart) >
                            0
                        ) {
                            mePresent = true;
                            break;
                        }
                    }

                    if (!locPairs.has(key)) {
                        locPairs.set(key, {
                            hardMatch,
                            mePresent,
                            accessType: parsed.accessType || 'public',
                            creatorId: creatorId,
                            overlapStart,
                            overlapEnd,
                            aJoin: sessA.leaveAt - sessA.time,
                            bJoin: sessB.leaveAt - sessB.time
                        });
                    } else {
                        const state = locPairs.get(key)!;
                        state.hardMatch = state.hardMatch || hardMatch;
                        state.mePresent = state.mePresent || mePresent;
                        state.overlapStart = Math.min(
                            state.overlapStart,
                            overlapStart
                        );
                        state.overlapEnd = Math.max(
                            state.overlapEnd,
                            overlapEnd
                        );
                    }
                }
            }
        }

        const instanceWeightMap: Record<string, number> = {
            invite: 1.0,
            'invite+': 1.0,
            private: 1.0,
            friends: 1.8,
            'friends+': 1.2,
            hidden: 1.2,
            group: 1.0,
            groupPublic: 1.0,
            groupPlus: 1.0,
            public: 0.5
        };

        for (const [key, state] of locPairs.entries()) {
            let stats = pairStats.get(key);
            if (!stats) {
                stats = {
                    count: 0,
                    weightedCount: 0,
                    countMeAbsent: 0,
                    countUnknown: 0,
                    hardMatch: false,
                    hostedByA: false,
                    hostedByB: false,
                    firstMeeting: Infinity,
                    lastMeeting: 0
                };
                pairStats.set(key, stats);
            }
            stats.count++;
            const weight = instanceWeightMap[state.accessType] || 0.5;
            stats.weightedCount += weight;

            if (!state.mePresent) {
                stats.countMeAbsent++;
            } else {
                // Math detection for "Unknown" (snapshot)
                // If they both joined within 3 minutes of each other
                if (Math.abs(state.aJoin - state.bJoin) <= 180000) {
                    let isSnapshot = false;
                    for (const m of mySess) {
                        const myStart = m.leaveAt - m.time;
                        if (
                            Math.abs(state.aJoin - myStart) <= 180000 &&
                            Math.abs(state.bJoin - myStart) <= 180000
                        ) {
                            isSnapshot = true;
                            break;
                        }
                    }
                    if (isSnapshot) {
                        stats.countUnknown++;
                    }
                }
            }

            if (state.hardMatch) stats.hardMatch = true;

            stats.firstMeeting = Math.min(
                stats.firstMeeting,
                state.overlapStart
            );
            stats.lastMeeting = Math.max(stats.lastMeeting, state.overlapEnd);

            const [idA, idB] = key.split('|');
            if (
                state.creatorId === idA &&
                (state.accessType === 'friends' ||
                    state.accessType === 'friends+' ||
                    state.accessType === 'hidden')
            ) {
                stats.hostedByA = true;
            }
            if (
                state.creatorId === idB &&
                (state.accessType === 'friends' ||
                    state.accessType === 'friends+' ||
                    state.accessType === 'hidden')
            ) {
                stats.hostedByB = true;
            }
        }
    }

    const knownFriendsSet = new Set<string>();
    const allCandidateIds = Array.from(candidatesSet);

    input.onProgress?.({
        done: 0,
        total: allCandidateIds.length * allCandidateIds.length,
        step: '扫描现有关系网'
    });
    let loopCounter = 0;

    for (const idA of allCandidateIds) {
        const listA = oldMutualSnapshot.get(idA) || new Set();
        for (const idB of allCandidateIds) {
            if (idA >= idB) continue;
            const listB = oldMutualSnapshot.get(idB) || new Set();
            const key = `${idA}|${idB}`;
            if (listA.has(idB) || listB.has(idA)) {
                knownFriendsSet.add(key);
            }
            if (++loopCounter % 50000 === 0) {
                input.signal?.throwIfAborted();
                input.onProgress?.({
                    done: loopCounter,
                    total: allCandidateIds.length * allCandidateIds.length,
                    step: '扫描现有关系网'
                });
                await new Promise((r) => setTimeout(r, 0));
            }
        }
    }

    const manualRelsList = input.manualLinks;

    const manualSet = new Set(
        manualRelsList.map((r) => {
            const [a, b] = [r.userIdA, r.userIdB].sort();
            return `${a}|${b}`;
        })
    );

    const result: RelationshipSuggestion[] = [];

    input.onProgress?.({
        done: 0,
        total: pairStats.size,
        step: '轨迹匹配分值测算'
    });
    loopCounter = 0;

    for (const [key, stats] of pairStats.entries()) {
        if (++loopCounter % 2000 === 0) {
            input.signal?.throwIfAborted();
            input.onProgress?.({
                done: loopCounter,
                total: pairStats.size,
                step: '轨迹匹配分值测算'
            });
            await new Promise((r) => setTimeout(r, 0));
        }

        if (knownFriendsSet.has(key)) continue;

        const [idA, idB] = key.split('|');
        const isAdded = manualSet.has(key);

        // User heuristic: If we found > 0 mutual friends for a player, it proves they have "Show Mutual Friends" ON.
        // If BOTH players have the feature ON, and they aren't friends in `knownFriendsSet`, they are definitively NOT friends. Skip.
        const listA = oldMutualSnapshot.get(idA);
        const listB = oldMutualSnapshot.get(idB);
        const hasMutualsA = listA && listA.size > 0;
        const hasMutualsB = listB && listB.size > 0;

        if (hasMutualsA && hasMutualsB) {
            continue;
        }

        const nameA = input.names.get(idA) || idA;
        const nameB = input.names.get(idB) || idB;

        let finalScore = 0;
        let displayScore = '';
        let tooltip = '';

        const crossHostMatch = stats.hostedByA && stats.hostedByB;

        const effectiveStartDate = stats.firstMeeting;
        const effectiveEndDate = stats.lastMeeting;
        const daysObservedSpan = Math.max(
            0,
            (effectiveEndDate - effectiveStartDate) / (1000 * 60 * 60 * 24)
        );
        const daysObserved = Math.max(14, daysObservedSpan);
        const startDateStr = localDate(effectiveStartDate);
        const endDateStr = localDate(effectiveEndDate);

        if (stats.hardMatch) {
            finalScore = 9999;
            displayScore = '私房';
            tooltip = `一票肯定 (硬性关联): 是\n由于双方之一是你们所处 Invite 私密房间的创建人，推测与其存在核心邀请关系。`;
        } else {
            const densityBonus = (stats.weightedCount / daysObserved) * 50;
            const baseScore = stats.weightedCount + densityBonus;

            let multiplierStr = '';
            let multiplier = 1.0;
            let multiplierFormula = '';
            let independentPct = 0;

            const indepRatio =
                stats.count > 0
                    ? (stats.countMeAbsent + stats.countUnknown) / stats.count
                    : 0;
            independentPct = Math.round(indepRatio * 100);

            if (indepRatio <= 0.08) {
                multiplier = 0.55 + (indepRatio / 0.08) * (1.08 - 0.55);
            } else {
                multiplier = 1.0 + indepRatio;
            }
            multiplierStr = `${Math.round(multiplier * 100)}%`;
            multiplierFormula =
                indepRatio <= 0.08
                    ? `惩罚: 0.55 + (${indepRatio.toFixed(3)} / 0.08) * 0.53`
                    : `增幅: 1.0 + ${indepRatio.toFixed(3)}`;

            if (crossHostMatch) {
                multiplier *= 1.2;
                multiplierStr = `${Math.round(multiplier * 100)}%`;
                multiplierFormula += `\n[连带增收: 观测到双向进入对方开启的房间，附加 1.2x 互派加成]`;
            }

            finalScore = Math.round(baseScore * multiplier);

            // 过滤逻辑：
            // 1. 如果是尚未添加的关系，只保留 5 分及以上的 (过滤掉低分噪音)
            // 2. 如果是已经添加的关系，保留 1 分及以上的 (确保已添加列表能显示分数)
            if (isAdded) {
                if (finalScore < 1) continue;
            } else {
                if (finalScore < 5) continue;
            }

            displayScore = `${finalScore}`;

            tooltip =
                `最终得分: ${finalScore}\n` +
                `计算式: ${baseScore.toFixed(1)} (基数) × ${multiplierStr} (权重)\n` +
                `─────\n` +
                `基数构成: ${stats.weightedCount.toFixed(1)} (实例加权分) + ${densityBonus.toFixed(1)} (短期密度分)\n` +
                `有效相遇: 实录 ${stats.count} 次\n` +
                `活跃窗口: ${Math.round(daysObservedSpan)} 天跨度 (${startDateStr} 至 ${endDateStr})\n\n` +
                `脱离玩家独立轨迹检出: \n` +
                `  > 异步共处 (我不在场): ${stats.countMeAbsent} 次\n` +
                `  > 事前共处 (快照未知): ${stats.countUnknown} 次\n` +
                `  * 综合独立率 = ${independentPct}%\n\n` +
                `独立权重影响: ${multiplierStr} \n[公式: ${multiplierFormula}]`;
        }

        result.push({
            userIdA: idA,
            userIdB: idB,
            nameA,
            nameB,
            score: finalScore,
            displayScore,
            tooltip,
            key,
            isAdded
        });
    }

    result.sort((a, b) => b.score - a.score);

    input.signal?.throwIfAborted();
    input.onProgress?.({
        done: pairStats.size,
        total: pairStats.size,
        step: '轨迹匹配分值测算'
    });
    return result;
}
