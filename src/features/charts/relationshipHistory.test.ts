import { describe, expect, it } from 'vitest';

import type { FeedRowOutput } from '@/platform/tauri/bindings';

import {
    buildRelationshipDailyValues,
    buildRelationshipSessions,
    buildRelationshipTimeline,
    findRelationshipOverlaps,
    summarizeRelationshipOverlaps
} from './relationshipHistory';

function feedRow(overrides: Partial<FeedRowOutput>): FeedRowOutput {
    return {
        type: 'GPS',
        userId: 'usr_a',
        displayName: 'A',
        created_at: '2026-01-02T01:00:00.000Z',
        previousLocation: 'wrld_one:instance',
        location: 'wrld_next:instance',
        time: 60 * 60 * 1000,
        ...overrides
    };
}

describe('relationship history', () => {
    it('uses GPS previousLocation and its leave timestamp to rebuild a session', () => {
        const sessions = buildRelationshipSessions([feedRow({})]);

        expect(sessions).toEqual([
            expect.objectContaining({
                location: 'wrld_one:instance',
                startMs: Date.parse('2026-01-02T00:00:00.000Z'),
                endMs: Date.parse('2026-01-02T01:00:00.000Z')
            })
        ]);
    });

    it('finds and summarizes only real overlapping intervals in the same instance', () => {
        const left = buildRelationshipSessions([feedRow({ userId: 'usr_a' })]);
        const right = buildRelationshipSessions([
            feedRow({
                userId: 'usr_b',
                displayName: 'B',
                created_at: '2026-01-02T01:30:00.000Z',
                time: 60 * 60 * 1000
            })
        ]);
        const overlaps = findRelationshipOverlaps(left, right);

        expect(overlaps).toHaveLength(1);
        expect(overlaps[0].durationMs).toBe(30 * 60 * 1000);
        expect(summarizeRelationshipOverlaps(overlaps)).toEqual([
            expect.objectContaining({
                overlapCount: 1,
                totalDurationMs: 30 * 60 * 1000
            })
        ]);
    });

    it('splits session duration across UTC days but counts one join', () => {
        const sessions = buildRelationshipSessions([
            feedRow({
                created_at: '2026-01-02T01:00:00.000Z',
                time: 2 * 60 * 60 * 1000
            })
        ]);
        const daily = buildRelationshipDailyValues(sessions).sort(
            (left, right) => left.day - right.day
        );

        expect(daily).toEqual([
            expect.objectContaining({
                totalTime: 60 * 60 * 1000,
                joinCount: 1
            }),
            expect.objectContaining({
                totalTime: 60 * 60 * 1000,
                joinCount: 0
            })
        ]);
    });

    it('uses a per-bucket Top-N union instead of plotting every historical user', () => {
        const chart = buildRelationshipTimeline(
            [
                {
                    userId: 'a',
                    displayName: 'A',
                    day: 0,
                    totalTime: 100,
                    joinCount: 0
                },
                {
                    userId: 'b',
                    displayName: 'B',
                    day: 0,
                    totalTime: 80,
                    joinCount: 0
                },
                {
                    userId: 'c',
                    displayName: 'C',
                    day: 1,
                    totalTime: 90,
                    joinCount: 0
                },
                {
                    userId: 'b',
                    displayName: 'B',
                    day: 1,
                    totalTime: 70,
                    joinCount: 0
                }
            ],
            1,
            1,
            true
        );

        expect(chart.series.map((entry) => entry.name).sort()).toEqual([
            'A',
            'C',
            'Others'
        ]);
        expect(
            chart.series.reduce((sum, entry) => sum + entry.values[0], 0)
        ).toBeCloseTo(100, 2);
    });
});
