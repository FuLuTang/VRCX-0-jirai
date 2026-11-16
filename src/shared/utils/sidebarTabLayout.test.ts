import { describe, expect, it } from 'vitest';

import {
    normalizeSidebarTabLayout,
    DEFAULT_SIDEBAR_TAB_LAYOUT,
    getVisibleSidebarTabs,
    moveSidebarTab,
    serializeSidebarTabLayout,
    type SidebarTabLayout
} from '@/shared/utils/sidebarTabLayout';

const WORLD_ID = 'wrld_11111111-1111-1111-1111-111111111111';

function savedWorldTabs(saved: unknown) {
    return normalizeSidebarTabLayout(JSON.stringify(saved))
        .filter((item) => item.type === 'worldRooms')
        .map((item) => item.id);
}

describe('saved sidebar layout with world tabs', () => {
    it('defaults to friends, tracked users, then groups', () => {
        expect(normalizeSidebarTabLayout([]).map((item) => item.id)).toEqual([
            'friends',
            'tracked-nonfriends',
            'groups'
        ]);
        expect(DEFAULT_SIDEBAR_TAB_LAYOUT.map((item) => item.id)).toEqual([
            'friends',
            'tracked-nonfriends',
            'groups'
        ]);
    });
    it('inserts tracked users after friends into legacy layouts without reordering existing tabs', () => {
        const saved = [
            DEFAULT_SIDEBAR_TAB_LAYOUT[0],
            {
                id: 'custom',
                type: 'favoriteCollection',
                name: 'Custom',
                sourceGroupKeys: []
            },
            DEFAULT_SIDEBAR_TAB_LAYOUT[2]
        ];
        expect(normalizeSidebarTabLayout(saved).map((item) => item.id)).toEqual(
            ['friends', 'tracked-nonfriends', 'custom', 'groups']
        );
    });
    it('preserves tracked tab visibility, chosen icon and reordered position through saving', () => {
        const layout = normalizeSidebarTabLayout([]).map((item) =>
            item.id === 'tracked-nonfriends'
                ? { ...item, visible: false, icon: 'lucide:Heart' }
                : item
        );
        const reordered = moveSidebarTab(layout, 1, 2);
        const restored = normalizeSidebarTabLayout(
            serializeSidebarTabLayout(reordered)
        );
        expect(restored).toEqual(reordered);
        expect(getVisibleSidebarTabs(restored).map((item) => item.id)).toEqual([
            'friends',
            'groups'
        ]);
        expect(
            restored.filter((item) => item.id === 'tracked-nonfriends')
        ).toHaveLength(1);
    });
    it('restores a pinned world tab exactly as it was saved', () => {
        const layout: SidebarTabLayout = [
            {
                id: 'friends',
                type: 'system',
                systemTab: 'friends',
                icon: 'lucide:UserRound',
                visible: true
            },
            {
                id: 'world-karaoke',
                type: 'worldRooms',
                worldId: WORLD_ID,
                name: 'Karaoke',
                visible: false
            },
            {
                id: 'groups',
                type: 'system',
                systemTab: 'groups',
                icon: 'lucide:UsersRound',
                visible: true
            }
        ];

        expect(
            normalizeSidebarTabLayout(serializeSidebarTabLayout(layout))
        ).toEqual(normalizeSidebarTabLayout(layout));
    });

    it('ignores a custom icon saved on a world tab because the world cover is its icon', () => {
        const [worldTab] = normalizeSidebarTabLayout(
            JSON.stringify([
                {
                    id: 'world-karaoke',
                    type: 'worldRooms',
                    worldId: WORLD_ID,
                    name: 'Karaoke',
                    icon: 'lucide:Gamepad2'
                }
            ])
        ).filter((item) => item.type === 'worldRooms');

        expect(worldTab).not.toHaveProperty('icon');
    });

    it('drops a saved world tab that has no valid world id', () => {
        expect(
            savedWorldTabs([
                { id: 'a', type: 'worldRooms', worldId: '', name: 'A' },
                { id: 'b', type: 'worldRooms', worldId: 'usr_x', name: 'B' }
            ])
        ).toEqual([]);
    });

    it('keeps a single tab when the same world was saved twice', () => {
        expect(
            savedWorldTabs([
                { id: 'a', type: 'worldRooms', worldId: WORLD_ID, name: 'A' },
                { id: 'b', type: 'worldRooms', worldId: WORLD_ID, name: 'B' }
            ])
        ).toEqual(['a']);
    });
});
