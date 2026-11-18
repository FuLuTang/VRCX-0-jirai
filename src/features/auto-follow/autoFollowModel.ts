import type { FavoriteGroupMap } from '@/domain/favorites/types';
import { presencePlace, presenceSection } from '@/domain/friends/presence';
import type { FriendRecord } from '@/domain/friends/types';
import { isRealInstance } from '@/shared/utils/instance';
import { normalizeString } from '@/shared/utils/string';

const FOLLOWABLE_STATUSES = new Set(['join me', 'active']);

/**
 * Favorite friends ("VIP") exactly as jirai `updateLocalFavoriteFriends`:
 * remote favorites filtered by the selected remote groups (when any non-local
 * group is selected in `localFavoriteFriendsGroups`), plus every local
 * favorite.
 */
export function buildAutoFollowFavoriteIdSet({
    favoriteFriendIds,
    groupedFavoriteFriendIdsByGroupKey,
    localFriendFavorites,
    localFavoriteFriendsGroups
}: {
    favoriteFriendIds: readonly string[] | null | undefined;
    groupedFavoriteFriendIdsByGroupKey:
        | Record<string, readonly string[]>
        | null
        | undefined;
    localFriendFavorites: FavoriteGroupMap | null | undefined;
    localFavoriteFriendsGroups: readonly string[] | null | undefined;
}): Set<string> {
    const ids = new Set<string>();
    const add = (id: unknown) => {
        const normalized = normalizeString(id);
        if (normalized) {
            ids.add(normalized);
        }
    };
    const groups = localFavoriteFriendsGroups ?? [];
    const remoteGroups = groups.filter((key) => !key.startsWith('local:'));
    if (remoteGroups.length > 0) {
        for (const key of remoteGroups) {
            for (const id of groupedFavoriteFriendIdsByGroupKey?.[key] ?? []) {
                add(id);
            }
        }
    } else {
        for (const id of favoriteFriendIds ?? []) {
            add(id);
        }
    }
    for (const groupIds of Object.values(localFriendFavorites ?? {})) {
        for (const id of groupIds ?? []) {
            add(id);
        }
    }
    return ids;
}

export type AutoFollowCandidate = {
    id: string;
    displayName: string;
    status: string;
    statusDescription: string;
    iconUrl: string;
    userColour: string;
    location: string;
    travelingTo: string;
    friend: FriendRecord;
};

/**
 * jirai AutoFollowDialog `availableFriends`: `onlineFriends` (online and not a
 * favorite) whose status is `join me` or `active` (A7-2).
 */
export function selectAutoFollowCandidates({
    onlineIds,
    friendsById,
    favoriteIds
}: {
    onlineIds: readonly string[];
    friendsById: Record<string, FriendRecord | undefined>;
    favoriteIds: ReadonlySet<string>;
}): AutoFollowCandidate[] {
    const candidates: AutoFollowCandidate[] = [];
    for (const id of onlineIds) {
        const friend = friendsById[id];
        if (!friend || favoriteIds.has(id)) {
            continue;
        }
        if (presenceSection(friend.$presence) !== 'online') {
            continue;
        }
        const status = normalizeString(friend.status);
        if (!FOLLOWABLE_STATUSES.has(status)) {
            continue;
        }
        const place = presencePlace(friend.$presence);
        candidates.push({
            id,
            displayName: normalizeString(friend.displayName) || id,
            status,
            statusDescription: normalizeString(friend.statusDescription),
            iconUrl: normalizeString(friend.iconUrl),
            userColour: normalizeString(friend.$userColour),
            location: normalizeString(place?.location.tag),
            travelingTo: normalizeString(place?.travelingTo?.tag),
            friend
        });
    }
    return candidates;
}

/** Whether the candidate row should show a Location instead of the status text. */
export function candidateShowsLocation(
    candidate: AutoFollowCandidate
): boolean {
    return (
        isRealInstance(candidate.location) ||
        isRealInstance(candidate.travelingTo)
    );
}
