import { useEffect, useMemo, useState } from 'react';

import { commands } from '@/platform/tauri/bindings';

import { normalizeResult, type QuickSearchResult } from '../quickSearch';
import { normalizeSearchQuery } from './quickSearchResultModel';

export type QuickSearchRecentState = {
    metUsers: QuickSearchResult[];
    joinedWorlds: QuickSearchResult[];
};

const EMPTY: QuickSearchRecentState = { metUsers: [], joinedWorlds: [] };

/**
 * Case-insensitive name filter for the recent groups (jirai
 * filterRecentByQuery): an empty query keeps every row.
 */
export function filterQuickSearchRecent(
    recent: QuickSearchRecentState,
    normalizedQuery: string
): QuickSearchRecentState {
    if (!normalizedQuery) {
        return recent;
    }
    const matches = (row: QuickSearchResult) =>
        normalizeSearchQuery(row.name).includes(normalizedQuery);
    return {
        metUsers: recent.metUsers.filter(matches),
        joinedWorlds: recent.joinedWorlds.filter(matches)
    };
}

/**
 * Recently met non-friends and recently joined worlds (#17, jirai
 * loadRecentItems): loaded once per opening of the quick search, for the
 * current account only. Failures leave the groups empty.
 */
export function useQuickSearchRecent({
    currentEndpoint,
    currentUserId,
    normalizedQuery,
    open
}: {
    currentEndpoint?: string | null;
    currentUserId?: string | null;
    normalizedQuery: string;
    open: boolean;
}): QuickSearchRecentState {
    const [loaded, setLoaded] = useState<{
        account: string;
        recent: QuickSearchRecentState;
    }>({ account: '', recent: EMPTY });
    const account = currentUserId
        ? `${currentUserId}|${currentEndpoint ?? ''}`
        : '';

    useEffect(() => {
        if (!open || !account) {
            return;
        }
        let active = true;
        commands
            .appQuickSearchRecent()
            .then((output) => {
                if (active) {
                    setLoaded({
                        account,
                        recent: {
                            metUsers: output.metUsers.map(normalizeResult),
                            joinedWorlds:
                                output.joinedWorlds.map(normalizeResult)
                        }
                    });
                }
            })
            .catch(() => {
                if (active) {
                    setLoaded({ account, recent: EMPTY });
                }
            });
        return () => {
            active = false;
        };
    }, [account, open]);

    const recent = open && loaded.account === account ? loaded.recent : EMPTY;
    return useMemo(
        () => filterQuickSearchRecent(recent, normalizedQuery),
        [normalizedQuery, recent]
    );
}
