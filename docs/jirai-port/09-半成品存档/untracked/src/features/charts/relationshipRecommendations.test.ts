import { describe, expect, it } from 'vitest';

import { scoreRelationshipRecommendations } from './relationshipRecommendations';

const base = { ownerUserId: 'usr_owner', selfUserId: 'usr_self' };
const evidence = (
    userId: string,
    startMs: number,
    endMs: number,
    accessType = 'friends'
) => ({
    ownerUserId: 'usr_owner',
    userId,
    displayName: userId,
    location: 'wrld_x:1',
    accessType,
    startMs,
    endMs
});

describe('scoreRelationshipRecommendations legacy fixtures', () => {
    it('locks deterministic old weights and canonical ordering', () => {
        const result = scoreRelationshipRecommendations({
            ...base,
            evidence: [
                evidence('usr_b', 0, 10),
                evidence('usr_a', 0, 10),
                evidence('usr_b', 20, 30),
                evidence('usr_a', 20, 30),
                evidence('usr_d', 0, 10, 'public'),
                evidence('usr_c', 0, 10, 'public')
            ]
        });
        expect(result.map(({ key, score }) => ({ key, score }))).toEqual([
            { key: 'usr_a|usr_b', score: 7 }
        ]);
    });
    it('explains private hosted overlap and filters invalid, self, manual, and mutual pairs', () => {
        const result = scoreRelationshipRecommendations({
            ...base,
            evidence: [
                {
                    ...evidence('usr_a', 0, 10, 'private'),
                    creatorUserId: 'usr_a'
                },
                evidence('usr_b', 0, 10, 'private'),
                evidence('usr_self', 0, 10),
                { ...evidence('usr_x', 0, 10), location: 'traveling' }
            ]
        });
        expect(result).toMatchObject([
            {
                key: 'usr_a|usr_b',
                score: 9999,
                reasons: ['private-hosted-overlap']
            }
        ]);
        expect(
            scoreRelationshipRecommendations({
                ...base,
                evidence: [
                    evidence('usr_a', 0, 10, 'private'),
                    evidence('usr_b', 0, 10, 'private')
                ],
                manualPairs: [
                    {
                        ownerUserId: 'usr_owner',
                        userIdA: 'usr_a',
                        userIdB: 'usr_b'
                    }
                ]
            })
        ).toEqual([]);
    });
});
