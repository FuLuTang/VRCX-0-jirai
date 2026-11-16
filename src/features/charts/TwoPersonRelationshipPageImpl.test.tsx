// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    runtime: { auth: { currentUserId: 'usr_owner' } },
    roster: { friendsById: {} as Record<string, unknown> },
    tracked: { currentUserId: 'usr_owner', entries: [] as unknown[] },
    query: vi.fn()
}));

vi.mock('@/state/runtimeStore', () => ({
    useRuntimeStore: Object.assign(
        (select: (state: typeof mocks.runtime) => unknown) =>
            select(mocks.runtime),
        {
            getState: () => mocks.runtime
        }
    )
}));
vi.mock('@/state/friendRosterStore', () => ({
    useFriendRosterStore: (select: (state: typeof mocks.roster) => unknown) =>
        select(mocks.roster)
}));
vi.mock('@/state/trackedNonfriendsStore', () => ({
    useTrackedNonfriendsStore: (
        select: (state: typeof mocks.tracked) => unknown
    ) => select(mocks.tracked)
}));
vi.mock('@/repositories/feedRepository', () => ({
    default: { queryFeedUserHistory: mocks.query }
}));
vi.mock('@/platform/tauri/bindings', () => ({ commands: {} }));
vi.mock('@/services/dialogService', () => ({ openWorldDialog: vi.fn() }));
vi.mock('@/components/Location', () => ({ Location: () => null }));
vi.mock('@/ui/shadcn/tooltip', () => ({
    Tooltip: ({ children }: { children: ReactNode }) => children,
    TooltipTrigger: ({ children }: { children: ReactNode }) => children,
    TooltipContent: () => null
}));

import { TwoPersonRelationshipPage } from './TwoPersonRelationshipPageImpl';

const friendId = 'usr_11111111-1111-1111-1111-111111111111';
const trackedId = 'usr_22222222-2222-2222-2222-222222222222';
const directId = 'usr_33333333-3333-3333-3333-333333333333';

describe('two-person local-history selection', () => {
    beforeEach(() => {
        mocks.query.mockReset().mockResolvedValue([]);
        mocks.roster.friendsById = {
            [friendId]: { id: friendId, displayName: 'Friend' }
        };
        mocks.tracked.currentUserId = 'usr_owner';
        mocks.tracked.entries = [
            { userId: friendId, displayName: 'Duplicate' },
            { userId: trackedId, displayName: 'Tracked' }
        ];
    });
    afterEach(cleanup);

    it('deduplicates friends and tracked players, and excludes the other selection', async () => {
        render(<TwoPersonRelationshipPage />);
        await waitFor(() =>
            expect(mocks.query).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 'usr_owner',
                    targetUserId: trackedId
                })
            )
        );
        const [left, right] = screen.getAllByRole('combobox');
        expect((left as HTMLInputElement).value).toBe('Friend');
        expect((right as HTMLInputElement).value).toBe('Tracked');
        await userEvent.click(left.parentElement!.querySelector('button')!);
        await waitFor(() =>
            expect(screen.getAllByRole('option')).toHaveLength(1)
        );
        expect(screen.getByRole('option').textContent).toBe('Friend');
    });

    it('keeps an entered ID through roster changes and empty candidates, querying only this account history', async () => {
        const page = render(<TwoPersonRelationshipPage />);
        const left = screen.getAllByRole('combobox')[0];
        await userEvent.clear(left);
        await userEvent.type(left, ` ${directId} `);
        await userEvent.keyboard('{ArrowDown}');
        expect(left.getAttribute('aria-activedescendant')).toBeTruthy();
        await userEvent.keyboard('{Enter}');
        await waitFor(() =>
            expect(mocks.query).toHaveBeenCalledWith({
                userId: 'usr_owner',
                targetUserId: directId,
                types: ['GPS', 'Offline'],
                maxEntries: 50000
            })
        );
        await userEvent.keyboard('{Escape}');
        await act(async () => {
            mocks.roster.friendsById = {};
            mocks.tracked.entries = [];
            page.rerender(<TwoPersonRelationshipPage />);
        });
        expect((left as HTMLInputElement).value).toBe(directId);
        expect(
            (screen.getAllByRole('combobox')[1] as HTMLInputElement).value
        ).toBe(trackedId);
        expect(
            mocks.query.mock.calls.every(
                ([query]) => query.userId === 'usr_owner'
            )
        ).toBe(true);
    });

    it('does not accept an invalid ID or the other player ID, or another account tracked list', async () => {
        mocks.tracked.currentUserId = 'usr_other';
        render(<TwoPersonRelationshipPage />);
        const [left, right] = screen.getAllByRole('combobox');
        expect((right as HTMLInputElement).value).toBe('');
        await userEvent.type(right, 'usr_not-a-uuid{Enter}');
        await userEvent.clear(right);
        await userEvent.type(right, `${friendId}{Enter}`);
        await act(async () => {});
        expect(mocks.query).not.toHaveBeenCalled();
        expect((left as HTMLInputElement).value).toBe('Friend');
    });

    it('accepts IDs with no candidates, then swaps and selects an existing candidate', async () => {
        mocks.roster.friendsById = {};
        mocks.tracked.entries = [];
        const page = render(<TwoPersonRelationshipPage />);
        const [left, right] = screen.getAllByRole(
            'combobox'
        ) as HTMLInputElement[];
        await userEvent.type(left, `${directId}{Enter}`);
        await userEvent.type(right, `${trackedId}{Enter}`);
        expect(left.value).toBe(directId);
        expect(right.value).toBe(trackedId);
        await userEvent.keyboard('{Escape}');
        await userEvent.click(
            page.container
                .querySelector('svg.lucide-arrow-left-right')!
                .closest('button')!
        );
        expect(left.value).toBe(trackedId);
        expect(right.value).toBe(directId);
        await act(async () => {
            mocks.roster.friendsById = {
                [friendId]: { id: friendId, displayName: 'Friend' }
            };
            page.rerender(<TwoPersonRelationshipPage />);
        });
        await userEvent.click(left.parentElement!.querySelector('button')!);
        await userEvent.click(
            await screen.findByRole('option', { name: 'Friend' })
        );
        expect(left.value).toBe('Friend');
        expect(right.value).toBe(directId);
        expect(mocks.query).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'usr_owner',
                targetUserId: friendId
            })
        );
    });
});
