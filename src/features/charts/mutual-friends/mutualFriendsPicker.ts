import type { FriendRosterById } from '@/domain/friends/types';

import { mutualFriendUsername } from './mutualFriendsGraphData';
import {
    isValidMutualFriendId,
    normalizeMutualFriendId
} from './mutualFriendsSettings';
import type {
    MutualFriendManualLink,
    MutualFriendPickerOption,
    MutualFriendSnapshot,
    MutualFriendTrackedUser
} from './mutualFriendsTypes';

export function truncateMutualFriendLabel(value: string, maxLength = 18) {
    const text = value;
    return text.length <= maxLength
        ? text
        : `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

export function buildMutualFriendPickerOption(
    userId: string,
    friendsById: FriendRosterById,
    fallbackName = '',
    degree?: number
): MutualFriendPickerOption | null {
    const normalizedId = normalizeMutualFriendId(userId);
    if (!isValidMutualFriendId(normalizedId)) {
        return null;
    }
    const user = friendsById[normalizedId] ?? null;
    const username = mutualFriendUsername(user);
    const label = user?.displayName || username || fallbackName || 'User';
    return {
        value: normalizedId,
        label,
        displayLabel: Number.isFinite(degree) ? `${label} (${degree})` : label,
        search: [label, username, normalizedId].filter(Boolean).join(' '),
        user,
        degree
    };
}

export function buildMutualFriendExcludePickerOptions(
    snapshot: MutualFriendSnapshot | null | undefined,
    friendsById: FriendRosterById,
    currentUserId: string,
    trackedUsers: readonly MutualFriendTrackedUser[] = [],
    manualLinks: readonly MutualFriendManualLink[] = [],
    historicalLinks: ReadonlyMap<string, string> | null | undefined = null
) {
    const seen = new Set<string>();
    const items: MutualFriendPickerOption[] = [];
    const trackedNames = new Map(
        trackedUsers.map((user) => [user.userId, user.displayName])
    );

    function pushOption(userId: string, fallbackName = '') {
        const normalizedId = normalizeMutualFriendId(userId);
        if (
            !isValidMutualFriendId(normalizedId) ||
            normalizedId === currentUserId ||
            seen.has(normalizedId)
        ) {
            return;
        }
        const option = buildMutualFriendPickerOption(
            normalizedId,
            friendsById,
            fallbackName
        );
        if (option) {
            seen.add(normalizedId);
            items.push(option);
        }
    }

    for (const friendId of Object.keys(friendsById)) {
        pushOption(friendId);
    }

    if (snapshot instanceof Map) {
        snapshot.forEach((mutualIds, friendId) => {
            pushOption(friendId, trackedNames.get(friendId) ?? '');
            for (const mutualId of Array.isArray(mutualIds) ? mutualIds : []) {
                pushOption(mutualId);
            }
        });
    }

    for (const user of trackedUsers) {
        pushOption(user.userId, user.displayName);
    }
    for (const relation of manualLinks) {
        pushOption(relation.userIdA);
        pushOption(relation.userIdB);
    }
    historicalLinks?.forEach((_, key) => {
        const [userIdA, userIdB] = key.split('__');
        pushOption(userIdA);
        pushOption(userIdB);
    });

    return items.sort((left, right) => left.label.localeCompare(right.label));
}
