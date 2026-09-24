import type { FeedReadModelResult } from '@/domain/feed/readModel';
import type { FeedFilter, FeedRowOutput } from '@/platform/tauri/bindings';

import configRepository from './configRepository';
import feedPersistenceRepository from './feedPersistenceRepository';
import type { FeedCursor } from './feedPersistenceRepository';
import userSessionRepository from './userSessionRepository';

export const FEED_FILTER_TYPES: readonly FeedFilter[] = Object.freeze([
    'GPS',
    'Online',
    'Offline',
    'Status',
    'Avatar',
    'Bio'
]);

export type FeedFilterType = FeedFilter;

export function isFeedFilterType(value: unknown): value is FeedFilterType {
    return FEED_FILTER_TYPES.some((filter) => filter === value);
}

interface FeedQueryOptions {
    userId: string;
    search?: string;
    filters?: FeedFilter[];
    favoriteUserIds?: string[];
    scopedUserIds?: readonly string[];
    excludedFavoriteUserIds?: string[];
    dateFrom?: string;
    dateTo?: string;
    maxEntries?: number;
    cursor?: FeedCursor | null;
    favoritesOnly?: boolean;
}

interface FeedLatestQueryOptions {
    userId: string;
    filters?: FeedFilter[];
    favoriteUserIds?: string[];
    scopedUserIds?: readonly string[];
    excludedFavoriteUserIds?: string[];
    favoritesOnly?: boolean;
    maxRows?: number;
}

/**
 * Compatibility shape for the relationship views originally implemented in
 * vrcx-0-jirai. This stays in the frontend: current vrcx already provides
 * the owner-scoped Feed query it needs.
 */
interface FeedUserHistoryQueryOptions {
    userId: string;
    targetUserId: string;
    types?: FeedFilter[];
    dateFrom?: string;
    dateTo?: string;
    maxEntries?: number;
}

interface FeedReadyState {
    normalizedUserId: string;
    maxTableSize: number;
    searchLimit: number;
}

const RELATIONSHIP_TIMELINE_PAGE_SIZE = 1000;

function normalizeUserId(value: string): string {
    return value.trim();
}

function normalizeUserIdList(value: readonly string[] = []): string[] {
    return Array.from(
        new Set(value.map((entry) => normalizeUserId(entry)).filter(Boolean))
    );
}

function normalizeFilterList(filters: FeedFilter[] = []): FeedFilterType[] {
    return Array.from(new Set(filters));
}

class FeedRepository {
    #currentUserId: string = '';

    async #ensureReady(userId: string): Promise<FeedReadyState> {
        const normalizedUserId = normalizeUserId(userId);
        if (!normalizedUserId) {
            throw new Error('FeedRepository requires a current user id.');
        }

        const [maxTableSize, searchLimit] = await Promise.all([
            configRepository.getInt('maxTableSize_v2', 500),
            configRepository.getInt('searchLimit', 50000)
        ]);

        if (this.#currentUserId !== normalizedUserId) {
            await userSessionRepository.ensureUserTables(normalizedUserId);
            this.#currentUserId = normalizedUserId;
        }

        return {
            normalizedUserId,
            maxTableSize,
            searchLimit
        };
    }

    async queryFeed({
        userId,
        search = '',
        filters = [],
        favoriteUserIds = [],
        scopedUserIds = [],
        excludedFavoriteUserIds = [],
        dateFrom = '',
        dateTo = '',
        maxEntries,
        cursor = null,
        favoritesOnly = false
    }: FeedQueryOptions): Promise<FeedRowOutput[]> {
        const { normalizedUserId, maxTableSize, searchLimit } =
            await this.#ensureReady(userId);
        const normalizedFilters = normalizeFilterList(filters);
        const normalizedFavorites = normalizeUserIdList(favoriteUserIds);
        const normalizedScoped = normalizeUserIdList(scopedUserIds);
        const normalizedExcludedFavorites = normalizeUserIdList(
            excludedFavoriteUserIds
        );
        const normalizedSearch = search.trim();

        if (normalizedSearch || dateFrom || dateTo) {
            return feedPersistenceRepository.searchFeedDatabase(
                normalizedSearch,
                normalizedFilters,
                normalizedFavorites,
                maxEntries ?? searchLimit,
                dateFrom,
                dateTo,
                normalizedUserId,
                normalizedExcludedFavorites,
                normalizedScoped,
                favoritesOnly
            );
        }

        return feedPersistenceRepository.lookupFeedDatabase(
            normalizedUserId,
            normalizedFilters,
            normalizedFavorites,
            maxEntries ??
                (normalizedScoped.length > 0 ? searchLimit : maxTableSize),
            cursor,
            normalizedExcludedFavorites,
            normalizedScoped
        );
    }

    async queryFeedPage(options: FeedQueryOptions): Promise<FeedRowOutput[]> {
        return this.queryFeed(options);
    }

    async queryFeedUserHistory({
        userId,
        targetUserId,
        types = [],
        dateFrom,
        dateTo,
        maxEntries
    }: FeedUserHistoryQueryOptions): Promise<FeedRowOutput[]> {
        return this.queryFeed({
            userId,
            scopedUserIds: [targetUserId],
            filters: types,
            dateFrom,
            dateTo,
            maxEntries
        });
    }

    /**
     * Reads every persisted location event for the current account. Feed tables
     * are already partitioned by owner (userId); leaving scopedUserIds empty
     * intentionally includes all players recorded by that owner.
     */
    async queryRelationshipTimelineHistory(
        userId: string
    ): Promise<FeedRowOutput[]> {
        const { normalizedUserId } = await this.#ensureReady(userId);
        const rows: FeedRowOutput[] = [];
        let cursor: FeedCursor | null = null;

        while (true) {
            const page = await feedPersistenceRepository.lookupFeedDatabase(
                normalizedUserId,
                ['GPS', 'Offline'],
                [],
                RELATIONSHIP_TIMELINE_PAGE_SIZE,
                cursor
            );
            rows.push(...page);
            if (page.length < RELATIONSHIP_TIMELINE_PAGE_SIZE) {
                return rows;
            }

            const lastRow = page[page.length - 1];
            if (
                !lastRow?.created_at ||
                !Number.isFinite(lastRow.rowId) ||
                !Number.isFinite(lastRow.sourceRank)
            ) {
                throw new Error(
                    'Relationship timeline pagination stopped: the Feed row is missing its cursor.'
                );
            }
            cursor = {
                createdAt: lastRow.created_at,
                rowId: lastRow.rowId as number,
                sourceRank: lastRow.sourceRank as number
            };
        }
    }

    async queryFeedLatest({
        userId,
        filters = [],
        favoriteUserIds = [],
        scopedUserIds = [],
        excludedFavoriteUserIds = [],
        favoritesOnly = false,
        maxRows
    }: FeedLatestQueryOptions): Promise<FeedReadModelResult<FeedRowOutput>> {
        const { normalizedUserId, maxTableSize } =
            await this.#ensureReady(userId);
        const normalizedFilters = normalizeFilterList(filters);
        const normalizedFavorites = normalizeUserIdList(favoriteUserIds);
        const normalizedScoped = normalizeUserIdList(scopedUserIds);
        const normalizedExcludedFavorites = normalizeUserIdList(
            excludedFavoriteUserIds
        );

        return feedPersistenceRepository.queryFeedLatest({
            userId: normalizedUserId,
            filters: normalizedFilters,
            favoriteUserIds: normalizedFavorites,
            scopedUserIds: normalizedScoped,
            excludedUserIds: normalizedExcludedFavorites,
            favoritesOnly,
            maxRows: maxRows ?? maxTableSize
        });
    }
}

const feedRepository = new FeedRepository();

export default feedRepository;
