import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FeedRowOutput } from '@/platform/tauri/bindings';

import {
    queryStatusDistributionHistory,
    STATUS_HISTORY_PAGE_SIZE
} from './statusDistributionQuery';

const query = vi.hoisted(() => vi.fn());
const selfQuery = vi.hoisted(() => vi.fn());
vi.mock('@/platform/tauri/bindings', () => ({
    commands: { appSelfStatusHistoryQuery: selfQuery }
}));
vi.mock('@/repositories/feedRepository', () => ({
    default: { queryFeedPage: query }
}));
beforeEach(() => {
    query.mockReset();
    selfQuery.mockReset();
});

describe('status distribution query ownership', () => {
    it.each(['usr_friend', 'usr_nonfriend'])(
        'reads %s within the observing account',
        async (target) => {
            query.mockResolvedValue([]);
            await queryStatusDistributionHistory('usr_owner', target);
            expect(query).toHaveBeenCalledWith({
                userId: 'usr_owner',
                scopedUserIds: [target],
                filters: ['Status', 'Online', 'Offline'],
                maxEntries: 1000,
                cursor: null
            });
        }
    );
    it('reads self through the expected-owner backend query, never friend feed', async () => {
        selfQuery.mockResolvedValue([]);
        await expect(
            queryStatusDistributionHistory('usr_owner', 'usr_owner')
        ).resolves.toEqual([]);
        expect(selfQuery).toHaveBeenCalledWith({
            expectedOwnerUserId: 'usr_owner'
        });
        expect(query).not.toHaveBeenCalled();
    });
    it('paginates beyond the normal list limit', async () => {
        const last = {
            rowId: 12,
            sourceRank: 2,
            created_at: '2026-01-01T00:00:00Z'
        } as FeedRowOutput;
        query
            .mockResolvedValueOnce(Array(STATUS_HISTORY_PAGE_SIZE).fill(last))
            .mockResolvedValueOnce([]);
        expect(
            await queryStatusDistributionHistory('usr_owner', 'usr_friend')
        ).toHaveLength(1000);
        expect(query.mock.calls[1][0].cursor).toEqual({
            rowId: 12,
            sourceRank: 2,
            createdAt: last.created_at
        });
    });
    it('stops pagination when the target changes while a page is loading', async () => {
        let active = true;
        query.mockImplementation(async () => {
            active = false;
            return Array(1000).fill({});
        });
        expect(
            await queryStatusDistributionHistory(
                'usr_owner',
                'usr_friend',
                () => active
            )
        ).toEqual([]);
        expect(query).toHaveBeenCalledTimes(1);
    });
    it('fails rather than reporting silently truncated history with a bad cursor', async () => {
        query.mockResolvedValue(Array(1000).fill({}));
        await expect(
            queryStatusDistributionHistory('usr_owner', 'usr_friend')
        ).rejects.toThrow('pagination cursor');
    });
});
