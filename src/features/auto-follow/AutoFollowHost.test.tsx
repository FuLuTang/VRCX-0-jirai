// @vitest-environment jsdom

import {
    act,
    cleanup,
    fireEvent,
    render,
    screen
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FriendRecord } from '@/domain/friends/types';
import { useFavoriteStore } from '@/state/favoriteStore';
import { useFriendRosterStore } from '@/state/friendRosterStore';

const mocks = vi.hoisted(() => ({
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    startAutoFollow: vi.fn(),
    stopAutoFollow: vi.fn(),
    handleAutoFollowTriggered: vi.fn(),
    refreshAutoFollowStatus: vi.fn()
}));

vi.mock('react-i18next', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-i18next')>();
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string, options?: { name?: string }) =>
                options?.name ? `${key}:${options.name}` : key
        })
    };
});
vi.mock('@/services/runtime-event-bridge/subscription', () => ({
    subscribeRuntimeEvent: mocks.subscribe
}));
vi.mock('./autoFollowService', () => ({
    startAutoFollow: mocks.startAutoFollow,
    stopAutoFollow: mocks.stopAutoFollow,
    handleAutoFollowTriggered: mocks.handleAutoFollowTriggered,
    refreshAutoFollowStatus: mocks.refreshAutoFollowStatus
}));
vi.mock('@/components/Location', () => ({
    Location: ({ location }: { location?: string }) => (
        <span data-testid="location">{location}</span>
    )
}));

import { AutoFollowHost, installAutoFollowDevHandle } from './AutoFollowHost';
import { openAutoFollowDialog, useAutoFollowStore } from './autoFollowStore';

const INSTANCE = 'wrld_00000000-0000-0000-0000-000000000001:12345~region(jp)';

function friend(id: string, status: string): FriendRecord {
    return {
        id,
        displayName: `Name ${id}`,
        status,
        statusDescription: '',
        tags: [],
        $presence: {
            kind: 'online',
            place: { location: { tag: INSTANCE }, travelingTo: null },
            platform: 'standalonewindows',
            onlineSinceMs: null
        }
    } as unknown as FriendRecord;
}

describe('AutoFollowHost (#7)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.subscribe.mockResolvedValue(mocks.unsubscribe);
        mocks.refreshAutoFollowStatus.mockResolvedValue({
            active: false,
            targetUserId: null,
            targetDisplayName: null
        });
        useAutoFollowStore.setState({
            open: false,
            status: {
                active: false,
                targetUserId: null,
                targetDisplayName: null
            }
        });
        useFriendRosterStore.setState({
            onlineIds: ['usr_join', 'usr_fav', 'usr_busy'],
            friendsById: {
                usr_join: friend('usr_join', 'join me'),
                usr_fav: friend('usr_fav', 'active'),
                usr_busy: friend('usr_busy', 'busy')
            }
        } as never);
        useFavoriteStore.setState({
            favoriteFriendIds: ['usr_fav'],
            groupedFavoriteFriendIdsByGroupKey: {},
            localFriendFavorites: {}
        } as never);
    });

    afterEach(() => {
        cleanup();
    });

    it('renders no visible entry until openAutoFollowDialog is called (A7-17)', async () => {
        render(<AutoFollowHost />);
        await act(async () => {});
        expect(screen.queryByText('jirai.auto_follow.title')).toBeNull();
        expect(document.body.textContent).toBe('');

        act(() => openAutoFollowDialog());
        expect(screen.getByText('jirai.auto_follow.title')).toBeTruthy();
        expect(screen.getByText('jirai.auto_follow.description')).toBeTruthy();
    });

    it('subscribes to autoFollowTriggered and forwards payloads; unsubscribes on unmount', async () => {
        const { unmount } = render(<AutoFollowHost />);
        await act(async () => {});
        expect(mocks.subscribe).toHaveBeenCalledWith(
            'autoFollowTriggered',
            expect.any(Function)
        );
        const handler = mocks.subscribe.mock.calls[0][1] as (
            p: unknown
        ) => void;
        const payload = {
            userId: 'usr_join',
            displayName: 'Name usr_join',
            location: INSTANCE,
            action: 'attach'
        };
        handler(payload);
        expect(mocks.handleAutoFollowTriggered).toHaveBeenCalledWith(payload);
        unmount();
        expect(mocks.unsubscribe).toHaveBeenCalled();
    });

    it('lists only online non-favorite join me / active friends and starts on click (A7-2)', async () => {
        render(<AutoFollowHost />);
        act(() => openAutoFollowDialog());
        const rows = screen.getAllByTestId('auto-follow-candidate');
        expect(rows).toHaveLength(1);
        expect(rows[0].textContent).toContain('Name usr_join');
        fireEvent.click(rows[0]);
        expect(mocks.startAutoFollow).toHaveBeenCalledWith(
            'usr_join',
            'Name usr_join'
        );
        expect(useAutoFollowStore.getState().open).toBe(false);
    });

    it('refreshes the Rust status whenever the dialog opens', async () => {
        render(<AutoFollowHost />);
        expect(mocks.refreshAutoFollowStatus).not.toHaveBeenCalled();
        act(() => openAutoFollowDialog());
        await act(async () => {});
        expect(mocks.refreshAutoFollowStatus).toHaveBeenCalledTimes(1);
    });

    it('installs the console handle only in development builds (A7-17)', () => {
        const prod: Record<string, unknown> = {};
        installAutoFollowDevHandle(prod, false)();
        expect(prod).toEqual({});

        const dev: Record<string, unknown> = {};
        const dispose = installAutoFollowDevHandle(dev, true);
        const handle = dev.__VRCX_JIRAI_AUTO_FOLLOW__ as { open(): void };
        act(() => handle.open());
        expect(useAutoFollowStore.getState().open).toBe(true);
        dispose();
        expect(dev).toEqual({});
    });

    it('shows the empty text when nobody is eligible', () => {
        useFriendRosterStore.setState({
            onlineIds: [],
            friendsById: {}
        } as never);
        render(<AutoFollowHost />);
        act(() => openAutoFollowDialog());
        expect(screen.getByText('jirai.auto_follow.empty')).toBeTruthy();
    });

    it('shows the current target with a stop button while following (A7-7, A7-8)', () => {
        useAutoFollowStore.setState({
            status: {
                active: true,
                targetUserId: 'usr_join',
                targetDisplayName: 'Name usr_join'
            }
        });
        render(<AutoFollowHost />);
        act(() => openAutoFollowDialog());
        expect(screen.getByTestId('auto-follow-current').textContent).toContain(
            'jirai.auto_follow.current_target:Name usr_join'
        );
        fireEvent.click(screen.getByText('jirai.auto_follow.stop'));
        expect(mocks.stopAutoFollow).toHaveBeenCalled();
    });
});

const appSources = import.meta.glob<string>(
    [
        '/src/**/*.{ts,tsx}',
        '!/src/**/*.test.{ts,tsx}',
        '!/src/features/auto-follow/**',
        '!/src/platform/tauri/bindings.ts'
    ],
    { query: '?raw', import: 'default', eager: true }
);

describe('auto follow entry stays hidden (A7-17)', () => {
    it('scans the app sources', () => {
        expect(Object.keys(appSources).length).toBeGreaterThan(500);
        expect(appSources['/src/app/GlobalHosts.tsx']).toBeDefined();
    });

    it('only the auto-follow feature module references the dialog or its opener', () => {
        const offenders = Object.entries(appSources)
            .filter(([, text]) =>
                [
                    'openAutoFollowDialog',
                    'AutoFollowDialog',
                    'auto_follow'
                ].some((needle) => text.includes(needle))
            )
            .map(([path]) => path);
        expect(offenders).toEqual([]);
    });

    it('GlobalHosts mounts only the host, not an entry control', () => {
        const text = appSources['/src/app/GlobalHosts.tsx'];
        expect(text).toContain('<AutoFollowHost />');
        expect(text).not.toContain('openAutoFollowDialog');
    });
});
