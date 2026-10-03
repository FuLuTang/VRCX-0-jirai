// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    state: {
        friendsById: {},
        onlineIds: [],
        favoriteFriendGroups: [],
        localFriendFavoriteGroups: [],
        groupedFavoriteFriendIdsByGroupKey: {},
        localFriendFavorites: [],
        auth: { currentUserId: 'owner', currentUserEndpoint: 'test' },
        groupInstances: { userId: 'owner', endpoint: 'test', instances: [] },
        tabLayout: [
            {
                id: 'friends',
                type: 'system',
                systemTab: 'friends',
                icon: 'lucide:UserRound',
                visible: true
            }
        ]
    },
    t: (key: string) => key
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: mocks.t }) }));
vi.mock('@/state/friendRosterStore', () => ({
    useFriendRosterStore: (select: (state: unknown) => unknown) =>
        select(mocks.state)
}));
vi.mock('@/state/favoriteStore', () => ({
    useFavoriteStore: (select: (state: unknown) => unknown) =>
        select(mocks.state)
}));
vi.mock('@/state/runtimeStore', () => ({
    useRuntimeStore: (select: (state: unknown) => unknown) =>
        select(mocks.state)
}));
vi.mock('@/state/sidebarTabStore', () => ({
    useSidebarTabStore: (select: (state: unknown) => unknown) =>
        select(mocks.state)
}));
import type { SidePanelPreferences } from './side-panel/sidePanelTypes';
import { useSidePanelTabData } from './useSidePanelTabData';
const prefs: SidePanelPreferences = {
    isHideFriendsInSameInstance: false,
    isSameInstanceAboveFavorites: false,
    isSidebarDivideByFriendGroup: false,
    sidebarFavoriteGroupOrder: [],
    sidebarFavoriteGroups: [],
    sidebarGroupByInstance: false,
    sidebarSortMethod1: '',
    sidebarSortMethod2: '',
    sidebarSortMethod3: ''
};
afterEach(cleanup);
describe('sidebar tab validity', () => {
    it.each(['tracked-nonfriends', 'friends'])(
        'keeps %s selected',
        (activeTab) => {
            const setActiveTab = vi.fn();
            renderHook(() =>
                useSidePanelTabData({ activeTab, prefs, setActiveTab })
            );
            expect(setActiveTab).not.toHaveBeenCalled();
        }
    );
    it('still falls back for a removed custom tab', () => {
        const setActiveTab = vi.fn();
        renderHook(() =>
            useSidePanelTabData({ activeTab: 'removed', prefs, setActiveTab })
        );
        expect(setActiveTab).toHaveBeenCalledWith('friends');
    });
});
