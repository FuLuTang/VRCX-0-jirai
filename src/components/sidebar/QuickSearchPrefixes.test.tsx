// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState, type PropsWithChildren } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { QuickSearchResult, QuickSearchState } from './quickSearch';

const mocks = vi.hoisted(() => ({
    results: null as unknown as QuickSearchState,
    lastQuery: ''
}));

class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverMock);
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn()
});

vi.mock('react-i18next', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-i18next')>();
    return { ...actual, useTranslation: () => ({ t: (key: string) => key }) };
});
vi.mock('@/shared/buildLabel', () => ({
    isUpdateCheckDisabledBuild: () => false
}));
vi.mock('@/lib/useKnownUser', () => ({ useKnownUserFacts: () => ({}) }));
vi.mock('@/services/vrcx0CssLayerService', () => ({ setRgb: vi.fn() }));
vi.mock('@/services/toolActionService', () => ({
    triggerToolByKey: vi.fn(() => Promise.resolve())
}));
vi.mock('@/services/directAccessService', () => ({
    directAccessParse: vi.fn(() => Promise.resolve(true))
}));
vi.mock('@/services/shellIntegrationService', () => ({
    getClipboardText: vi.fn(() => Promise.resolve(''))
}));
vi.mock('@/services/toastService', () => ({
    toast: { add: vi.fn(() => 'toast'), close: vi.fn() }
}));
vi.mock('@/lib/useSettingsSearch', () => ({
    useSettingsSearch: (query: string) =>
        query
            ? [{ id: 'setting-alpha', labelKey: 'Setting Alpha', path: [] }]
            : []
}));
vi.mock('./QuickSearchNavCommands', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('./QuickSearchNavCommands')>();
    return {
        ...actual,
        useNavCommands: (query: string) =>
            query
                ? [
                      {
                          key: 'nav-alpha',
                          label: 'Nav Alpha',
                          icon: () => null,
                          keywords: 'alpha',
                          target: { type: 'path', path: '/alpha' }
                      }
                  ]
                : [],
        NavResultGroup: ({ items }: { items: unknown[] }) =>
            items.length ? <div data-testid="group-nav">nav</div> : null,
        SettingsResultGroup: ({ items }: { items: unknown[] }) =>
            items.length ? (
                <div data-testid="group-settings">settings</div>
            ) : null
    };
});
vi.mock('./quick-search/useQuickSearchHistory', () => ({
    useQuickSearchHistory: () => ({
        items: [
            {
                id: 'wrld_recent',
                type: 'world',
                source: 'history',
                name: 'Recent World'
            }
        ],
        remember: vi.fn()
    })
}));
vi.mock('./quick-search/useQuickSearchResults', () => ({
    useQuickSearchResults: ({
        normalizedQuery
    }: {
        normalizedQuery: string;
    }) => {
        mocks.lastQuery = normalizedQuery;
        return mocks.results;
    }
}));
vi.mock('./QuickSearchResults', () => ({
    ResultGroup: ({ title, items }: { title: string; items: unknown[] }) =>
        items.length ? (
            <div data-testid={`group-${title}`}>{items.length}</div>
        ) : null
}));
vi.mock('@/ui/shadcn/dialog', () => ({
    Dialog: ({ children }: PropsWithChildren) => children,
    DialogContent: ({ children }: PropsWithChildren) => <div>{children}</div>,
    DialogDescription: ({ children }: PropsWithChildren) => (
        <div>{children}</div>
    ),
    DialogHeader: ({ children }: PropsWithChildren) => <div>{children}</div>,
    DialogTitle: ({ children }: PropsWithChildren) => <div>{children}</div>
}));

import { QuickSearchDialog } from './QuickSearchDialog';

function row(id: string, type: QuickSearchResult['type']): QuickSearchResult {
    return {
        id,
        type,
        source: 'test',
        name: id,
        subtitle: '',
        imageUrl: '',
        seedData: null,
        memo: '',
        note: '',
        matchedField: 'name',
        userColour: ''
    };
}

function everyCategory(): QuickSearchState {
    return {
        status: 'ready',
        detail: '',
        friends: [row('usr_1', 'friend')],
        ownAvatars: [row('avtr_1', 'avatar')],
        favoriteAvatars: [row('avtr_2', 'avatar')],
        ownWorlds: [row('wrld_1', 'world')],
        favoriteWorlds: [row('wrld_2', 'world')],
        ownGroups: [row('grp_1', 'group')],
        joinedGroups: [row('grp_2', 'group')]
    };
}

const GROUPS = {
    friends: 'group-side_panel.friends',
    ownAvatars: 'group-side_panel.search_own_avatars',
    favoriteAvatars: 'group-side_panel.search_fav_avatars',
    ownWorlds: 'group-side_panel.search_own_worlds',
    favoriteWorlds: 'group-side_panel.search_fav_worlds',
    ownGroups: 'group-side_panel.search_own_groups',
    joinedGroups: 'group-side_panel.search_joined_groups',
    nav: 'group-nav',
    settings: 'group-settings',
    recent: 'group-side_panel.search_recent'
} as const;

function Harness({ initial }: { initial: string }) {
    const [query, setQuery] = useState(initial);
    return (
        <QuickSearchDialog
            open
            query={query}
            onQueryChange={setQuery}
            onOpenChange={vi.fn()}
            onDirectAccess={vi.fn()}
        />
    );
}

function visibleGroups(query: string) {
    render(
        <MemoryRouter>
            <Harness initial={query} />
        </MemoryRouter>
    );
    return Object.entries(GROUPS)
        .filter(([, id]) => screen.queryByTestId(id))
        .map(([name]) => name);
}

describe('QuickSearchDialog prefixes (M4, #17)', () => {
    beforeEach(() => {
        mocks.results = everyCategory();
    });

    afterEach(() => {
        cleanup();
    });

    // A17-10
    it.each([
        ['!al', ['friends']],
        ['!', ['friends']],
        ['@a', ['ownWorlds', 'favoriteWorlds']],
        ['@', ['ownWorlds', 'favoriteWorlds']],
        ['#a', ['ownGroups', 'joinedGroups']],
        ['#', ['ownGroups', 'joinedGroups']]
    ])('%s shows only the matching category', (query, expected) => {
        expect(visibleGroups(query)).toEqual(expected);
        expect(mocks.lastQuery).toBe(query);
        expect(screen.queryByText('side_panel.search_open_direct')).toBeNull();
    });

    // A17-11
    it('keeps every category, navigation and settings without a prefix', () => {
        expect(visibleGroups('alpha')).toEqual([
            'friends',
            'ownAvatars',
            'favoriteAvatars',
            'ownWorlds',
            'favoriteWorlds',
            'ownGroups',
            'joinedGroups',
            'nav',
            'settings'
        ]);
    });

    it('lists the three prefixes in the empty-search overview', () => {
        expect(visibleGroups('')).toEqual(['recent']);
        expect(screen.getByText('side_panel.search_prefixes')).toBeTruthy();
        for (const key of [
            'side_panel.search_prefix_friends',
            'side_panel.search_prefix_worlds',
            'side_panel.search_prefix_groups'
        ]) {
            expect(screen.getByText(key)).toBeTruthy();
        }
    });

    it('switching from a prefix back to plain text restores all categories', () => {
        render(
            <MemoryRouter>
                <Harness initial="!al" />
            </MemoryRouter>
        );
        expect(screen.queryByTestId(GROUPS.ownWorlds)).toBeNull();
        fireEvent.change(screen.getByRole('combobox'), {
            target: { value: 'al' }
        });
        expect(screen.getByTestId(GROUPS.ownWorlds)).toBeTruthy();
        expect(screen.getByTestId(GROUPS.friends)).toBeTruthy();
    });
});
