// @vitest-environment jsdom
import {
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    accountId: 'owner',
    tracked: {
        currentUserId: 'owner',
        entries: [{ userId: 'usr_test', displayName: 'Test user' }],
        loadStatus: 'ready',
        error: null,
        load: vi.fn(),
        reset: vi.fn(),
        add: vi.fn(),
        remove: vi.fn()
    },
    open: vi.fn(),
    confirm: vi.fn()
}));
vi.mock('@/state/runtimeStore', () => ({
    useRuntimeStore: (select: (state: unknown) => unknown) =>
        select({ auth: { currentUserId: mocks.accountId } })
}));
vi.mock('@/state/trackedNonfriendsStore', () => ({
    useTrackedNonfriendsStore: (select: (state: unknown) => unknown) =>
        select(mocks.tracked)
}));
vi.mock('@/services/dialogService', () => ({ openUserDialog: mocks.open }));
vi.mock('@/state/modalStore', () => ({
    useModalStore: <T,>(
        selector: (state: { confirm: typeof mocks.confirm }) => T
    ) => selector({ confirm: mocks.confirm })
}));
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, values?: unknown) =>
            key + (values ? JSON.stringify(values) : '')
    })
}));
vi.mock('@/ui/shadcn/button', () => ({
    Button: ({
        size: _size,
        variant: _variant,
        ...props
    }: import('react').ComponentProps<'button'> & {
        size?: string;
        variant?: string;
    }) => <button {...props} />
}));
vi.mock('@/ui/shadcn/input', () => ({
    Input: (props: import('react').ComponentProps<'input'>) => (
        <input {...props} />
    )
}));
import { TrackedNonfriendsSidebar } from './TrackedNonfriendsSidebar';

beforeEach(() => {
    vi.clearAllMocks();
    mocks.accountId = 'owner';
    mocks.tracked.currentUserId = 'owner';
    mocks.tracked.loadStatus = 'ready';
    mocks.tracked.error = null;
});
afterEach(cleanup);
describe('tracked nonfriends sidebar', () => {
    it('loads the account list, displays its count and opens the selected profile', () => {
        render(<TrackedNonfriendsSidebar />);
        expect(mocks.tracked.load).toHaveBeenCalledWith('owner');
        expect(screen.getByRole('status').textContent).toContain('"count":1');
        fireEvent.click(screen.getByRole('button', { name: 'Test user' }));
        expect(mocks.open).toHaveBeenCalledWith({
            userId: 'usr_test',
            title: 'Test user'
        });
    });
    it('confirms before removing only the selected entry without opening its profile', async () => {
        let resolveConfirmation!: (result: {
            ok: boolean;
            reason: string;
        }) => void;
        mocks.confirm.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveConfirmation = resolve;
                })
        );
        render(<TrackedNonfriendsSidebar />);
        fireEvent.click(
            screen.getByRole('button', {
                name: 'tracked_nonfriends.remove_user'
            })
        );

        expect(mocks.confirm).toHaveBeenCalledWith({
            title: 'tracked_nonfriends.confirm_remove.title',
            description: 'tracked_nonfriends.confirm_remove.description',
            confirmText: 'common.actions.delete',
            cancelText: 'common.actions.cancel',
            destructive: true
        });
        expect(mocks.tracked.remove).not.toHaveBeenCalled();
        expect(mocks.open).not.toHaveBeenCalled();

        resolveConfirmation({ ok: true, reason: 'ok' });
        await waitFor(() => {
            expect(mocks.tracked.remove).toHaveBeenCalledTimes(1);
            expect(mocks.tracked.remove).toHaveBeenCalledWith(
                'owner',
                'usr_test'
            );
        });
        expect(mocks.open).not.toHaveBeenCalled();
    });
    it('filters the list without changing the total count', () => {
        render(<TrackedNonfriendsSidebar filterQuery="absent" />);
        expect(screen.queryByRole('button', { name: 'Test user' })).toBeNull();
        expect(screen.getByRole('status').textContent).toContain('"count":1');
    });
    it('does not expose entries or counts from another account', () => {
        mocks.tracked.currentUserId = 'other';
        render(<TrackedNonfriendsSidebar />);
        expect(screen.queryByRole('button', { name: 'Test user' })).toBeNull();
        expect(screen.getByRole('status').textContent).toContain('"count":0');
    });
    it('resets the list when logged out', () => {
        mocks.accountId = '';
        render(<TrackedNonfriendsSidebar />);
        expect(mocks.tracked.reset).toHaveBeenCalled();
        expect(screen.queryByRole('button', { name: 'Test user' })).toBeNull();
    });
});
