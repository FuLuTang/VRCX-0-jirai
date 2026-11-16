import { describe, expect, it } from 'vitest';

import {
    computeRelationshipSuggestions,
    type RecommendationInput
} from '../relationshipRecommendationsAlgorithm';
import legacyResults from './legacyManualRelations.fixture.json';
import {
    observedJoinOrder,
    observedPeakPlayerCount
} from './relationshipEvidence';

function fixture(access = ''): RecommendationInput {
    const location = `wrld_fixture:1${access}`;
    return {
        eventsByLocation: new Map([
            [
                location,
                [
                    { userId: 'a', leaveAt: 1_000_000, time: 600_000 },
                    { userId: 'b', leaveAt: 1_000_000, time: 600_000 }
                ]
            ]
        ]),
        mySessions: new Map(),
        oldMutualSnapshot: new Map(),
        friendIds: ['a', 'b'],
        trackedIds: [],
        names: new Map([
            ['a', 'A'],
            ['b', 'B']
        ]),
        manualLinks: []
    };
}

describe('legacy manualRelations computeSuggestions fixture scores', () => {
    // Full results produced by executing the sibling legacy store, not copied
    // from the migrated function: score, order, labels and complete evidence.
    it.each(Object.keys(legacyResults) as (keyof typeof legacyResults)[])(
        'matches the legacy %s fixture in full',
        async (scenario) => {
            const input = fixture(
                scenario === 'friends' || scenario === 'cross'
                    ? '~friends(a)'
                    : scenario === 'private'
                      ? '~private(a)'
                      : ''
            );
            if (['present', 'manual', 'snapshot'].includes(scenario))
                input.mySessions.set('wrld_fixture:1', [
                    {
                        leaveAt: 1_000_000,
                        time: scenario === 'snapshot' ? 600_000 : 1_000_000
                    }
                ]);
            if (scenario === 'manual')
                input.manualLinks = [{ userIdA: 'b', userIdB: 'a' }];
            if (scenario === 'cross')
                input.eventsByLocation.set(
                    'wrld_fixture:2~friends(b)',
                    input.eventsByLocation.values().next().value!
                );
            if (scenario === 'known')
                input.oldMutualSnapshot.set('a', new Set(['b']));
            if (scenario === 'visible') {
                input.oldMutualSnapshot.set('a', new Set(['x']));
                input.oldMutualSnapshot.set('b', new Set(['y']));
            }
            if (scenario === 'stranger') input.friendIds = ['a'];
            if (scenario === 'duplicate') {
                const rows = input.eventsByLocation.get('wrld_fixture:1')!;
                rows.push(...rows.map((row) => ({ ...row })));
            }
            expect(await computeRelationshipSuggestions(input)).toEqual(
                legacyResults[scenario]
            );
        }
    );
    it('retains public independent score 5, evidence and canonical pair', async () => {
        const [row] = await computeRelationshipSuggestions(fixture());
        expect(row).toMatchObject({
            key: 'a|b',
            score: 5,
            displayScore: '5',
            isAdded: false
        });
        expect(row.tooltip).toContain('异步共处 (我不在场): 1 次');
        expect(row.tooltip).toContain('最终得分: 5');
    });
    it('retains 5/1 thresholds for present non-snapshot observations', async () => {
        const input = fixture();
        input.mySessions.set('wrld_fixture:1', [
            { leaveAt: 1_000_000, time: 1_000_000 }
        ]);
        expect(await computeRelationshipSuggestions(input)).toEqual([]);
        input.manualLinks = [{ userIdA: 'b', userIdB: 'a' }];
        expect(await computeRelationshipSuggestions(input)).toMatchObject([
            { score: 1, isAdded: true }
        ]);
    });
    it('retains snapshot independence and friends weight', async () => {
        const input = fixture();
        input.mySessions.set('wrld_fixture:1', [
            { leaveAt: 1_000_000, time: 600_000 }
        ]);
        expect(await computeRelationshipSuggestions(input)).toMatchObject([
            { score: 5 }
        ]);
        expect(
            await computeRelationshipSuggestions(fixture('~friends(a)'))
        ).toMatchObject([{ score: 16 }]);
    });
    it('retains private hard match 9999 and stable top ordering', async () => {
        const input = fixture('~private(a)');
        input.eventsByLocation.set('wrld_other:2', [
            { userId: 'b', leaveAt: 1_000_000, time: 600_000 },
            { userId: 'c', leaveAt: 1_000_000, time: 600_000 }
        ]);
        input.trackedIds = ['c'];
        expect(await computeRelationshipSuggestions(input)).toMatchObject([
            { key: 'a|b', score: 9999, displayScore: '私房' },
            { key: 'b|c', score: 5 }
        ]);
    });
    it('retains bidirectional host multiplier 1.2, scoring one meeting per location', async () => {
        const input = fixture('~friends(a)');
        input.eventsByLocation.set(
            'wrld_fixture:2~friends(b)',
            input.eventsByLocation.values().next().value!
        );
        expect(await computeRelationshipSuggestions(input)).toMatchObject([
            { score: 39 }
        ]);
        const duplicate = fixture();
        const rows = duplicate.eventsByLocation.get('wrld_fixture:1')!;
        rows.push(...rows.map((row) => ({ ...row })));
        expect(await computeRelationshipSuggestions(duplicate)).toMatchObject([
            { score: 5 }
        ]);
    });
    it('filters known OLD, mutually exposed nonfriends and untracked strangers', async () => {
        const known = fixture();
        known.oldMutualSnapshot.set('a', new Set(['b']));
        expect(await computeRelationshipSuggestions(known)).toEqual([]);
        const visible = fixture();
        visible.oldMutualSnapshot.set('a', new Set(['x']));
        visible.oldMutualSnapshot.set('b', new Set(['y']));
        expect(await computeRelationshipSuggestions(visible)).toEqual([]);
        const stranger = fixture();
        stranger.friendIds = ['a'];
        expect(await computeRelationshipSuggestions(stranger)).toEqual([]);
    });
    it('does not return cancelled calculations', async () => {
        const input = fixture();
        input.signal = AbortSignal.abort();
        await expect(
            computeRelationshipSuggestions(input)
        ).rejects.toMatchObject({ name: 'AbortError' });
    });
});

describe('local relationship evidence', () => {
    it('uses legacy join-first tie sweep and ignores invalid/incomplete records', () => {
        const rows = [
            {
                type: 'OnPlayerLeft',
                created_at: '2026-01-01T00:01:00Z',
                time: 60_000
            },
            {
                type: 'OnPlayerLeft',
                created_at: '2026-01-01T00:02:00Z',
                time: 60_000
            },
            {
                type: 'OnPlayerJoined',
                created_at: '2026-01-01T00:01:00Z',
                time: 60_000
            },
            { type: 'OnPlayerLeft', created_at: 'invalid', time: 60_000 }
        ];
        expect(observedPeakPlayerCount(rows)).toBe(2);
        expect(observedPeakPlayerCount([])).toBeNull();
        expect(
            observedPeakPlayerCount([
                {
                    type: 'OnPlayerLeft',
                    created_at: rows[0].created_at,
                    time: 0
                }
            ])
        ).toBeNull();
    });
    it('never calls near-time or missing records a mutual arrival', () => {
        expect(observedJoinOrder(0, 180000)).toBe('unknown');
        expect(observedJoinOrder(NaN, 180001)).toBe('unknown');
        expect(observedJoinOrder(180001, 0)).toBe('leftPlayer');
        expect(observedJoinOrder(0, 180001)).toBe('rightPlayer');
    });
});
