import { commands, type FeedRowOutput } from '@/platform/tauri/bindings';
import type { FeedCursor } from '@/repositories/feedPersistenceRepository';
import feedRepository from '@/repositories/feedRepository';

export const STATUS_HISTORY_PAGE_SIZE = 1000;

/** Friend and tracked nonfriend Feed records belong to the observing account.
 * Self reads only its dedicated status/session evidence query.
 */
export async function queryStatusDistributionHistory(
    ownerUserId: string,
    targetUserId: string,
    isActive = () => true
): Promise<FeedRowOutput[]> {
    if (!ownerUserId || !targetUserId) {
        throw new Error('Status history requires an owner and target.');
    }
    if (!isActive()) return [];
    if (ownerUserId === targetUserId) {
        const rows = await commands.appSelfStatusHistoryQuery({
            expectedOwnerUserId: ownerUserId
        });
        return isActive() ? rows : [];
    }
    const rows: FeedRowOutput[] = [];
    let cursor: FeedCursor | null = null;
    while (isActive()) {
        const page = await feedRepository.queryFeedPage({
            userId: ownerUserId,
            scopedUserIds: [targetUserId],
            filters: ['Status', 'Online', 'Offline'],
            maxEntries: STATUS_HISTORY_PAGE_SIZE,
            cursor
        });
        if (!isActive()) return [];
        rows.push(...page);
        if (page.length < STATUS_HISTORY_PAGE_SIZE) return rows;
        const last = page[page.length - 1];
        if (
            !last.created_at ||
            !Number.isFinite(last.rowId) ||
            !Number.isFinite(last.sourceRank)
        ) {
            throw new Error('Status history is missing its pagination cursor.');
        }
        const next = {
            createdAt: last.created_at,
            rowId: last.rowId!,
            sourceRank: last.sourceRank!
        };
        if (cursor && JSON.stringify(cursor) === JSON.stringify(next)) {
            throw new Error('Status history cursor did not advance.');
        }
        cursor = next;
    }
    return [];
}
