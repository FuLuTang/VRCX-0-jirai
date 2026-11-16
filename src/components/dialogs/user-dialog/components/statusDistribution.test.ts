import { describe, expect, it } from 'vitest';

import type { FeedRowOutput } from '@/platform/tauri/bindings';

import {
    buildStatusDistribution,
    buildStatusDistributionBuckets,
    statusBucketDays
} from './statusDistribution';

function row(
    type: FeedRowOutput['type'],
    created_at: string,
    status?: string
): FeedRowOutput {
    return {
        rowId: 1,
        type,
        created_at,
        userId: 'usr_target',
        displayName: 'Target',
        status
    } as FeedRowOutput;
}

describe('buildStatusDistribution', () => {
    it('does not infer online time from status changes without presence evidence', () => {
        expect(
            buildStatusDistribution(
                [
                    row('Status', '2026-01-01T00:00:00Z', 'active'),
                    row('Status', '2026-01-01T01:00:00Z', 'busy')
                ],
                'usr_target',
                Date.parse('2026-01-01T03:00:00Z')
            )
        ).toEqual([]);
    });

    it('does not treat an unmatched Offline or a zero-length Online as an interval', () => {
        const status = row('Status', '2026-01-01T00:00:00Z', 'active');
        const now = Date.parse('2026-01-01T03:00:00Z');
        expect(
            buildStatusDistribution(
                [status, row('Offline', '2026-01-01T01:00:00Z')],
                'usr_target',
                now
            )
        ).toEqual([]);
        expect(
            buildStatusDistribution(
                [status, row('Online', '2026-01-01T03:00:00Z')],
                'usr_target',
                now,
                'online'
            )
        ).toEqual([]);
    });

    it('returns no distribution for an empty history', () => {
        expect(buildStatusDistribution([], 'usr_target', Date.now())).toEqual(
            []
        );
    });

    it('counts only observed online portions of status intervals', () => {
        expect(
            buildStatusDistribution(
                [
                    row('Status', '2026-01-01T00:00:00Z', 'join me'),
                    row('Status', '2026-01-01T02:00:00Z', 'ask me'),
                    row('Online', '2026-01-01T00:30:00Z'),
                    row('Offline', '2026-01-01T01:30:00Z'),
                    row('Online', '2026-01-01T02:30:00Z'),
                    row('Offline', '2026-01-01T03:30:00Z')
                ],
                'usr_target',
                Date.parse('2026-01-01T04:00:00Z')
            )
        ).toEqual([
            { status: 'join me', seconds: 3600 },
            { status: 'ask me', seconds: 3600 }
        ]);
    });

    it('splits across midnight and excludes an offline status change until the next Online', () => {
        expect(
            buildStatusDistribution(
                [
                    row('Offline', '2026-01-01T22:00:00Z'),
                    row('Status', '2026-01-01T23:00:00Z', 'active'),
                    row('Online', '2026-01-01T23:30:00Z'),
                    row('Offline', '2026-01-02T00:30:00Z'),
                    row('Status', '2026-01-02T01:00:00Z', 'busy'),
                    row('Online', '2026-01-02T01:30:00Z'),
                    row('Offline', '2026-01-02T02:30:00Z')
                ],
                'usr_target',
                Date.parse('2026-01-02T03:00:00Z')
            )
        ).toEqual([
            { status: 'active', seconds: 3600 },
            { status: 'busy', seconds: 3600 }
        ]);
    });

    it('leaves online time before the first known status unassigned', () => {
        expect(
            buildStatusDistribution(
                [
                    row('Online', '2026-01-01T00:00:00Z'),
                    row('Status', '2026-01-01T01:00:00Z', 'active'),
                    row('Offline', '2026-01-01T02:00:00Z')
                ],
                'usr_target',
                Date.parse('2026-01-01T03:00:00Z')
            )
        ).toEqual([{ status: 'active', seconds: 3600 }]);
    });

    it('counts an open Online interval only through now, not future events', () => {
        expect(
            buildStatusDistribution(
                [
                    row('Status', '2026-01-01T00:00:00Z', 'active'),
                    row('Online', '2026-01-01T01:00:00Z'),
                    row('Status', '2026-01-01T02:00:00Z', 'busy'),
                    row('Offline', '2026-01-01T04:00:00Z')
                ],
                'usr_target',
                Date.parse('2026-01-01T03:00:00Z'),
                'online'
            )
        ).toEqual([
            { status: 'active', seconds: 3600 },
            { status: 'busy', seconds: 3600 }
        ]);
    });

    it('extends a missing Offline endpoint to now only when current state is online', () => {
        const rows = [
            row('Status', '2026-01-01T00:00:00Z', 'active'),
            row('Online', '2026-01-01T01:00:00Z')
        ];
        const now = Date.parse('2026-01-01T02:00:00Z');
        expect(
            buildStatusDistribution(rows, 'usr_target', now, 'online')
        ).toEqual([{ status: 'active', seconds: 3600 }]);
        for (const state of [undefined, 'offline', 'unknown', 'active']) {
            expect(
                buildStatusDistribution(rows, 'usr_target', now, state)
            ).toEqual([]);
        }
    });

    it('retains closed online time but excludes a later unclosed interval while currently offline', () => {
        const rows = [
            row('Status', '2026-01-01T00:00:00Z', 'active'),
            row('Online', '2026-01-01T00:00:00Z'),
            row('Offline', '2026-01-01T01:00:00Z'),
            row('Status', '2026-01-01T01:30:00Z', 'busy'),
            row('Online', '2026-01-01T02:00:00Z')
        ];
        const now = Date.parse('2026-01-01T03:00:00Z');
        expect(
            buildStatusDistribution(rows, 'usr_target', now, 'offline')
        ).toEqual([{ status: 'active', seconds: 3600 }]);
        expect(
            buildStatusDistribution(rows, 'usr_target', now, 'online')
        ).toEqual([
            { status: 'active', seconds: 3600 },
            { status: 'busy', seconds: 3600 }
        ]);
    });

    it('does not double count consecutive or duplicate Online events and handles same-time Offline conservatively', () => {
        expect(
            buildStatusDistribution(
                [
                    row('Offline', '2026-01-01T02:30:00Z'),
                    row('Online', '2026-01-01T00:30:00Z'),
                    row('Status', '2026-01-01T01:00:00Z', 'active'),
                    row('Offline', '2026-01-01T01:00:00Z'),
                    row('Online', '2026-01-01T01:00:00Z'),
                    row('Offline', '2026-01-01T02:00:00Z'),
                    row('Status', '2026-01-01T00:00:00Z', 'active'),
                    row('Online', '2026-01-01T00:00:00Z')
                ],
                'usr_target',
                Date.parse('2026-01-01T03:00:00Z')
            )
        ).toEqual([{ status: 'active', seconds: 3600 }]);
    });

    it('stops carrying a known status when a later status observation is unsupported', () => {
        expect(
            buildStatusDistribution(
                [
                    row('Online', '2026-01-01T00:00:00Z'),
                    row('Status', '2026-01-01T00:00:00Z', 'active'),
                    row('Status', '2026-01-01T01:00:00Z', 'unknown'),
                    row('Status', '2026-01-01T02:00:00Z', 'busy'),
                    row('Offline', '2026-01-01T03:00:00Z')
                ],
                'usr_target',
                Date.parse('2026-01-01T04:00:00Z')
            )
        ).toEqual([
            { status: 'active', seconds: 3600 },
            { status: 'busy', seconds: 3600 }
        ]);
    });

    it('ignores invalid, unrelated, and unsupported rows', () => {
        const unrelated = {
            ...row('Status', '2026-01-01T00:00:00Z', 'active'),
            userId: 'usr_other'
        };
        expect(
            buildStatusDistribution(
                [
                    unrelated,
                    row('Status', 'not-a-date', 'active'),
                    row('Status', '2026-01-01T00:00:00Z', 'unknown')
                ],
                'usr_target',
                Date.parse('2026-01-01T01:00:00Z')
            )
        ).toEqual([]);
    });
});

describe('status distribution calendar buckets', () => {
    it('splits confirmed time at UTC midnight with dates matching actual boundaries', () => {
        const buckets = buildStatusDistributionBuckets(
            [
                row('Status', '2026-01-01T23:00:00Z', 'active'),
                row('Online', '2026-01-01T23:30:00Z'),
                row('Status', '2026-01-02T00:00:00Z', 'busy'),
                row('Offline', '2026-01-02T00:30:00Z')
            ],
            'usr_target',
            1,
            Date.parse('2026-01-02T01:00:00Z')
        );
        expect(
            buckets.map((b) => [
                b.label,
                b.totalSeconds,
                b.percentages.active,
                b.percentages.busy
            ])
        ).toEqual([
            ['2026-01-01', 1800, 100, 0],
            ['2026-01-02', 1800, 0, 100]
        ]);
    });

    it('uses known online lamp time as denominator, not offline or unknown time', () => {
        const buckets = buildStatusDistributionBuckets(
            [
                row('Online', '2026-01-01T00:00:00Z'),
                row('Status', '2026-01-01T01:00:00Z', 'active'),
                row('Status', '2026-01-01T02:00:00Z', 'unknown'),
                row('Status', '2026-01-01T03:00:00Z', 'busy'),
                row('Offline', '2026-01-01T06:00:00Z')
            ],
            'usr_target',
            1,
            Date.parse('2026-01-02T00:00:00Z')
        );
        expect(buckets[0].totalSeconds).toBe(14400);
        expect(buckets[0].percentages.active).toBe(25);
        expect(buckets[0].percentages.busy).toBe(75);
    });

    it('leaves zero-sample days at zero and never divides by zero', () => {
        const buckets = buildStatusDistributionBuckets(
            [
                row('Status', '2026-01-01T00:00:00Z', 'active'),
                row('Online', '2026-01-01T00:00:00Z'),
                row('Offline', '2026-01-01T01:00:00Z'),
                row('Online', '2026-01-03T00:00:00Z'),
                row('Offline', '2026-01-03T01:00:00Z')
            ],
            'usr_target',
            1,
            Date.parse('2026-01-04T00:00:00Z')
        );
        expect(buckets[1].totalSeconds).toBe(0);
        expect(Object.values(buckets[1].percentages)).toEqual([0, 0, 0, 0]);
        expect(buildStatusDistributionBuckets([], 'usr_target', 1)).toEqual([]);
    });

    it('does not invent either missing online endpoint', () => {
        const status = row('Status', '2026-01-01T00:00:00Z', 'active');
        const now = Date.parse('2026-01-01T02:00:00Z');
        expect(
            buildStatusDistributionBuckets(
                [status, row('Offline', '2026-01-01T01:00:00Z')],
                'usr_target',
                1,
                now,
                'online'
            )
        ).toEqual([]);
        const open = [status, row('Online', '2026-01-01T01:00:00Z')];
        expect(
            buildStatusDistributionBuckets(
                open,
                'usr_target',
                1,
                now,
                'offline'
            )
        ).toEqual([]);
        expect(
            buildStatusDistributionBuckets(
                open,
                'usr_target',
                1,
                now,
                'online'
            )[0].totalSeconds
        ).toBe(3600);
    });

    it('uses the legacy nonlinear 1–90 day scale', () => {
        expect([0, 51, 100].map(statusBucketDays)).toEqual([1, 10, 90]);
    });
});
