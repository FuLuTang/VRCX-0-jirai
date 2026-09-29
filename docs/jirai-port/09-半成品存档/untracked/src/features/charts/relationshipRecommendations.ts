export type RecommendationEvidence = {
    ownerUserId: string;
    userId: string;
    displayName: string;
    location: string;
    accessType: string;
    creatorUserId?: string;
    startMs: number;
    endMs: number;
    selfPresent?: boolean;
};

export type RecommendationInput = {
    ownerUserId: string;
    selfUserId: string;
    evidence: readonly RecommendationEvidence[];
    mutualPairs?: readonly {
        ownerUserId: string;
        userIdA: string;
        userIdB: string;
    }[];
    manualPairs?: readonly {
        ownerUserId: string;
        userIdA: string;
        userIdB: string;
    }[];
    ignoredKeys?: ReadonlySet<string>;
    limit?: number;
};

export type RelationshipRecommendation = {
    key: string;
    userIdA: string;
    userIdB: string;
    nameA: string;
    nameB: string;
    score: number;
    reasons: string[];
};

export function canonicalRecommendationKey(a: string, b: string): string {
    const left = a.trim();
    const right = b.trim();
    return left < right ? `${left}|${right}` : `${right}|${left}`;
}

function validLocation(location: string): boolean {
    const value = location.trim().toLowerCase();
    return (
        Boolean(value) &&
        !['offline', 'traveling', 'private', 'private:private'].includes(value)
    );
}

/** Pure, deterministic port of the old co-presence weight rules. */
export function scoreRelationshipRecommendations(
    input: RecommendationInput
): RelationshipRecommendation[] {
    const owner = input.ownerUserId.trim();
    const self = input.selfUserId.trim();
    const manual = new Set(
        (input.manualPairs || [])
            .filter((pair) => pair.ownerUserId === owner)
            .map((pair) =>
                canonicalRecommendationKey(pair.userIdA, pair.userIdB)
            )
    );
    const mutual = new Set(
        (input.mutualPairs || [])
            .filter((pair) => pair.ownerUserId === owner)
            .map((pair) =>
                canonicalRecommendationKey(pair.userIdA, pair.userIdB)
            )
    );
    const groups = new Map<string, RecommendationEvidence[]>();
    for (const item of input.evidence) {
        if (
            item.ownerUserId !== owner ||
            !item.userId.trim() ||
            item.userId === self ||
            !validLocation(item.location) ||
            item.endMs <= item.startMs
        )
            continue;
        const key = item.location.trim();
        groups.set(key, [...(groups.get(key) || []), item]);
    }
    const output = new Map<string, RelationshipRecommendation>();
    const weights: Record<string, number> = {
        invite: 1,
        'invite+': 1,
        private: 1,
        friends: 1.8,
        'friends+': 1.2,
        hidden: 1.2,
        group: 1,
        grouppublic: 1,
        groupplus: 1,
        public: 0.5
    };
    for (const values of groups.values())
        for (let index = 0; index < values.length; index += 1)
            for (let other = index + 1; other < values.length; other += 1) {
                const left = values[index],
                    right = values[other];
                if (left.userId === right.userId) continue;
                const start = Math.max(left.startMs, right.startMs),
                    end = Math.min(left.endMs, right.endMs);
                if (end <= start) continue;
                const key = canonicalRecommendationKey(
                    left.userId,
                    right.userId
                );
                if (
                    manual.has(key) ||
                    mutual.has(key) ||
                    input.ignoredKeys?.has(key)
                )
                    continue;
                const current = output.get(key) || {
                    key,
                    userIdA: key.split('|')[0],
                    userIdB: key.split('|')[1],
                    nameA:
                        left.userId < right.userId
                            ? left.displayName
                            : right.displayName,
                    nameB:
                        left.userId < right.userId
                            ? right.displayName
                            : left.displayName,
                    score: 0,
                    reasons: []
                };
                const access = left.accessType.toLowerCase();
                const hard =
                    ['invite', 'private'].includes(access) &&
                    (left.creatorUserId === left.userId ||
                        left.creatorUserId === right.userId);
                if (hard) {
                    current.score = 9999;
                    current.reasons = ['private-hosted-overlap'];
                } else if (current.score !== 9999) {
                    const score = weights[access] || 0.5;
                    current.score +=
                        score *
                        (left.selfPresent || right.selfPresent ? 0.55 : 2);
                    current.reasons.push(`overlap:${access || 'unknown'}`);
                }
                output.set(key, current);
            }
    return [...output.values()]
        .filter((item) => item.score >= 5 || item.score === 9999)
        .map((item) => ({ ...item, score: Math.round(item.score) }))
        .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key))
        .slice(0, Math.max(0, Math.min(input.limit ?? 100, 100)));
}
