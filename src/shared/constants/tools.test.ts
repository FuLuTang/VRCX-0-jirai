import { describe, expect, it } from 'vitest';

import {
    getToolsByCategory,
    toolCategories,
    toolDefinitionMap,
    toolNavDefinitions
} from './tools';

describe('tool catalog categories', () => {
    it('uses the intended category order and tool grouping', () => {
        expect(toolCategories.map((category) => category.key)).toEqual([
            'system',
            'image',
            'shortcuts',
            'automation',
            'group',
            'vrchat',
            'data',
            'debug',
            'other'
        ]);
        expect(
            Object.fromEntries(
                toolCategories.map((category) => [
                    category.key,
                    getToolsByCategory(category.key).map((tool) => tool.key)
                ])
            )
        ).toEqual({
            system: ['sync-workflow'],
            image: ['screenshot-metadata', 'gallery', 'inventory'],
            shortcuts: [
                'vrc-photos',
                'steam-screenshots',
                'vrcx-data',
                'vrchat-data',
                'crash-dumps'
            ],
            automation: [
                'app-launcher',
                'presence-schedule',
                'presence-room-rules',
                'presence-invite-requests'
            ],
            group: ['group-calendar', 'my-groups', 'group-moderation'],
            vrchat: ['vrchat-config', 'launch-options'],
            data: [
                'profile-backup',
                'registry-backup',
                'discord-names',
                'export-notes',
                'export-friend-list',
                'export-own-avatars'
            ],
            debug: ['vrchat-log'],
            other: ['llm-endpoints', 'edit-invite-message']
        });
    });
});

describe('tool navigation definitions', () => {
    it('keeps the legacy workflow tool and dialog keys under system tools', () => {
        expect(toolDefinitionMap.get('sync-workflow')).toMatchObject({
            category: 'system',
            titleKey: 'view.tools.system_tools.info_completion',
            action: { type: 'dialog', dialogKey: 'sync-workflow' }
        });
    });
    it('dispatches every pinned tool through the shared tool owner', () => {
        for (const tool of toolDefinitionMap.values()) {
            expect(
                toolNavDefinitions.find(
                    (definition) => definition.key === `tool-${tool.key}`
                )
            ).toMatchObject({
                action: { type: 'tool', toolKey: tool.key }
            });
        }
    });
});
