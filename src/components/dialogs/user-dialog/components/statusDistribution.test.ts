import { describe, expect, it } from 'vitest';

import type { FeedRowOutput } from '@/platform/tauri/bindings';

import { buildStatusDistribution } from './statusDistribution';

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
    it('uses status changes when online/offline history is unavailable', () => {
        expect(
            buildStatusDistribution(
                [
                    row('Status', '2026-01-01T00:00:00Z', 'active'),
                    row('Status', '2026-01-01T01:00:00Z', 'busy')
                ],
                'usr_target',
                Date.parse('2026-01-01T03:00:00Z')
            )
        ).toEqual([
            { status: 'active', seconds: 3600 },
            { status: 'busy', seconds: 7200 }
        ]);
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
