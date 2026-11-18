import { describe, expect, it } from 'vitest';

import type { FriendRecord } from '@/domain/friends/types';

import {
    buildAutoFollowFavoriteIdSet,
    candidateShowsLocation,
    selectAutoFollowCandidates
} from './autoFollowModel';

const INSTANCE = 'wrld_00000000-0000-0000-0000-000000000001:12345~region(jp)';

function friend(
    id: string,
    status: string,
    presence: FriendRecord['$presence'] = {
        kind: 'online',
        place: {
            location: { tag: INSTANCE } as never,
            travelingTo: null
        },
        platform: 'standalonewindows',
        onlineSinceMs: null
    }
): FriendRecord {
    return {
        id,
        displayName: id.toUpperCase(),
        status,
        statusDescription: `desc ${id}`,
        tags: [],
        $presence: presence
    } as unknown as FriendRecord;
}

describe('buildAutoFollowFavoriteIdSet (jirai updateLocalFavoriteFriends)', () => {
    it('uses every remote favorite plus local favorites when no remote group is selected', () => {
        const ids = buildAutoFollowFavoriteIdSet({
            favoriteFriendIds: ['usr_a', 'usr_b'],
            groupedFavoriteFriendIdsByGroupKey: {
                'friend:group_0': ['usr_a'],
                'friend:group_1': ['usr_b']
            },
            localFriendFavorites: { Mine: ['usr_local'] },
            localFavoriteFriendsGroups: ['local:Mine']
        });
        expect([...ids].sort()).toEqual(['usr_a', 'usr_b', 'usr_local']);
    });

    it('filters remote favorites by the selected remote groups but keeps all local favorites', () => {
        const ids = buildAutoFollowFavoriteIdSet({
            favoriteFriendIds: ['usr_a', 'usr_b'],
            groupedFavoriteFriendIdsByGroupKey: {
                'friend:group_0': ['usr_a'],
                'friend:group_1': ['usr_b']
            },
            localFriendFavorites: { Other: ['usr_local'] },
            localFavoriteFriendsGroups: ['friend:group_0']
        });
        expect([...ids].sort()).toEqual(['usr_a', 'usr_local']);
    });
});

describe('selectAutoFollowCandidates (A7-2)', () => {
    it('keeps online, non-favorite friends whose status is join me or active', () => {
        const friendsById = {
            usr_join: friend('usr_join', 'join me'),
            usr_active: friend('usr_active', 'active'),
            usr_ask: friend('usr_ask', 'ask me'),
            usr_busy: friend('usr_busy', 'busy'),
            usr_fav: friend('usr_fav', 'join me'),
            usr_web: friend('usr_web', 'active', {
                kind: 'active',
                platform: 'web'
            }),
            usr_off: friend('usr_off', 'join me', { kind: 'offline' })
        };
        const candidates = selectAutoFollowCandidates({
            onlineIds: [
                'usr_join',
                'usr_active',
                'usr_ask',
                'usr_busy',
                'usr_fav',
                'usr_web',
                'usr_off',
                'usr_missing'
            ],
            friendsById,
            favoriteIds: new Set(['usr_fav'])
        });
        expect(candidates.map((row) => row.id)).toEqual([
            'usr_join',
            'usr_active'
        ]);
        expect(candidates[0]).toMatchObject({
            displayName: 'USR_JOIN',
            location: INSTANCE
        });
    });

    it('shows a location only for real instances, otherwise the status text', () => {
        const [inInstance] = selectAutoFollowCandidates({
            onlineIds: ['usr_a'],
            friendsById: { usr_a: friend('usr_a', 'active') },
            favoriteIds: new Set()
        });
        const [privateRow] = selectAutoFollowCandidates({
            onlineIds: ['usr_b'],
            friendsById: {
                usr_b: friend('usr_b', 'active', {
                    kind: 'online',
                    place: {
                        location: { tag: 'private' } as never,
                        travelingTo: null
                    },
                    platform: 'standalonewindows',
                    onlineSinceMs: null
                })
            },
            favoriteIds: new Set()
        });
        expect(candidateShowsLocation(inInstance)).toBe(true);
        expect(candidateShowsLocation(privateRow)).toBe(false);
    });
});
