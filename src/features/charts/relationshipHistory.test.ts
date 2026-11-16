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

    it('assigns full duration to the event UTC day and counts distinct rooms once', () => {
        const sessions = buildRelationshipSessions([
            feedRow({
                created_at: '2026-01-02T01:00:00.000Z',
                time: 2 * 60 * 60 * 1000,
                previousLocation: 'wrld_one:instance'
            }),
            feedRow({
                created_at: '2026-01-02T05:00:00.000Z',
                time: 30 * 60 * 1000,
                previousLocation: 'wrld_one:instance'
            }),
            feedRow({
                created_at: '2026-01-02T08:00:00.000Z',
                time: 30 * 60 * 1000,
                previousLocation: 'wrld_two:instance'
            })
        ]);
        const daily = buildRelationshipDailyValues(sessions);

        expect(daily).toEqual([
            expect.objectContaining({
                day: Math.floor(
                    Date.parse('2026-01-02T00:00:00Z') / 86_400_000
                ),
                totalTime: 3 * 60 * 60 * 1000,
                joinCount: 2
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
