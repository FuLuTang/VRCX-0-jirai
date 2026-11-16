import { describe, expect, it } from 'vitest';

import { buildMutualHistoryRows } from './userDialogMutualHistory';

const old = [
    { mutualId: 'usr_current', date: '2026-07-21T00:00:00Z' },
    { mutualId: 'usr_history', date: '2026-06-01T00:00:00Z' }
];

describe('user dialog mutual history', () => {
    it('shows complete API results as confirmed and OLD-only rows as historical', () => {
        const rows = buildMutualHistoryRows(
            [
                {
                    id: 'usr_current',
                    displayName: 'Current',
                    $mutualObservedAt: '2026-09-26T00:00:00Z'
                }
            ],
            true,
            old,
            { usr_history: { id: 'usr_history', displayName: 'History' } }
        );
        expect(rows).toEqual([
            {
                id: 'usr_current',
                displayName: 'Current',
                $mutualObservedAt: '2026-09-26T00:00:00Z',
                $mutualDate: '2026-09-26T00:00:00Z',
                $mutualConfirmed: true
            },
            {
                id: 'usr_history',
                displayName: 'History',
                $mutualDate: '2026-06-01T00:00:00Z',
                $mutualConfirmed: false
            }
        ]);
    });

    it('keeps all historical rows unconfirmed when the API failed or is still loading', () => {
        const rows = buildMutualHistoryRows(
            [{ id: 'usr_current', $mutualObservedAt: '2026-09-26T00:00:00Z' }],
            false,
            old,
            {}
        );
        expect(rows).toHaveLength(2);
        expect(rows.every((row) => row.$mutualConfirmed === false)).toBe(true);
    });
});
