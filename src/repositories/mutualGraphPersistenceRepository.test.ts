import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    snapshot: vi.fn(),
    extras: vi.fn(),
    history: vi.fn()
}));

vi.mock('@/platform/tauri/bindings', () => ({
    commands: {
        appMutualGraphSnapshotGet: mocks.snapshot,
        appMutualGraphExtrasGet: mocks.extras,
        appMutualGraphHistoryGet: mocks.history
    }
}));

import repository from './mutualGraphPersistenceRepository';

describe('mutual graph history repository', () => {
    beforeEach(() => {
        mocks.snapshot.mockReset();
        mocks.extras.mockReset();
        mocks.history.mockReset();
        mocks.extras.mockResolvedValue({ trackedUsers: [], manualLinks: [] });
    });

    it('uses the latest valid date for an undirected graph edge while preserving directed detail rows', async () => {
        mocks.snapshot.mockResolvedValue({
            friendIds: ['usr_a', 'usr_b'],
            links: [],
            historicalLinks: [
                {
                    friendId: 'usr_a',
                    mutualId: 'usr_b',
                    date: '2026-09-26T00:00:00Z'
                },
                {
                    friendId: 'usr_b',
                    mutualId: 'usr_a',
                    date: '2026-07-21T00:00:00Z'
                }
            ],
            meta: []
        });
        mocks.history.mockResolvedValue({
            lastSuccessfulAt: '2026-09-26T00:00:00Z',
            links: [
                {
                    friendId: 'usr_a',
                    mutualId: 'usr_b',
                    date: '2026-09-26T00:00:00Z'
                }
            ]
        });

        const graph = await repository.getSnapshot('usr_owner');
        expect(graph.historicalLinks.get('usr_a__usr_b')).toBe(
            '2026-09-26T00:00:00Z'
        );
        expect((await repository.getHistory('usr_a')).links).toEqual([
            {
                friendId: 'usr_a',
                mutualId: 'usr_b',
                date: '2026-09-26T00:00:00Z'
            }
        ]);
        expect(mocks.history).toHaveBeenCalledWith('usr_a');
    });
});
