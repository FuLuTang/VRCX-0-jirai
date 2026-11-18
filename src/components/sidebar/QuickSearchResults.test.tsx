// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Command, CommandList } from '@/ui/shadcn/command';

import type { QuickSearchResult } from './quickSearch';
import { ResultGroup } from './QuickSearchResults';

vi.mock('react-i18next', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-i18next')>();
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string) =>
                ({
                    'dialog.user.info.memo': 'Memo',
                    'dialog.user.info.note': 'Note',
                    'dialog.user.info.bio': 'Bio'
                })[key] ?? key
        })
    };
});

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

const LONG_BIO =
    'I love Kyoto tea houses. '.repeat(20) + 'The end of a very long bio.';

function friend(overrides: Partial<QuickSearchResult>): QuickSearchResult {
    return {
        id: 'usr_1',
        type: 'friend',
        source: 'friends',
        name: 'Alpha',
        subtitle: '',
        imageUrl: '',
        seedData: null,
        memo: '',
        note: '',
        bio: '',
        matchedField: 'name',
        userColour: '',
        ...overrides
    };
}

function renderRows(items: QuickSearchResult[]) {
    return render(
        <Command shouldFilter={false}>
            <CommandList>
                <ResultGroup title="Friends" items={items} onSelect={vi.fn()} />
            </CommandList>
        </Command>
    );
}

describe('QuickSearchResults bio row (#14)', () => {
    afterEach(() => {
        cleanup();
    });

    it('shows the bio row only when the friend matched on bio (A14-8)', () => {
        renderRows([
            friend({
                id: 'usr_bio',
                name: 'Bio Match',
                bio: 'Kyoto lover',
                matchedField: 'bio'
            }),
            friend({
                id: 'usr_name',
                name: 'Kyoto Name',
                bio: 'Kyoto bio that must stay hidden',
                matchedField: 'name'
            })
        ]);

        const rows = screen.getAllByTestId('quick-search-bio');
        expect(rows).toHaveLength(1);
        expect(rows[0].textContent).toBe('Bio: Kyoto lover');
        expect(
            screen.queryByText(/Kyoto bio that must stay hidden/)
        ).toBeNull();
    });

    it('keeps memo and note rows visible for a bio match (A14-8)', () => {
        renderRows([
            friend({
                memo: 'memo text',
                note: 'note text',
                bio: 'Kyoto lover',
                matchedField: 'bio'
            })
        ]);

        expect(screen.getByText('Memo: memo text')).toBeTruthy();
        expect(screen.getByText('Note: note text')).toBeTruthy();
        expect(screen.getByTestId('quick-search-bio').textContent).toBe(
            'Bio: Kyoto lover'
        );
    });

    it('renders the whole bio text and truncates only through styling (A14-10)', () => {
        renderRows([friend({ bio: LONG_BIO, matchedField: 'bio' })]);

        const row = screen.getByTestId('quick-search-bio');
        expect(row.textContent).toBe(`Bio: ${LONG_BIO}`);
        expect(row.className).toContain('truncate');
    });

    it('does not render an empty bio row', () => {
        renderRows([friend({ bio: '', matchedField: 'bio', memo: 'm' })]);

        expect(screen.queryByTestId('quick-search-bio')).toBeNull();
    });
});
