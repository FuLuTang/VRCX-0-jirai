// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppToastOptions } from '@/services/toastService';

const commandMocks = vi.hoisted(() => ({
    appVrchatGroupOrderGet: vi.fn(),
    appVrchatGroupOrderSet: vi.fn()
}));

const repositoryMocks = vi.hoisted(() => ({
    getUserGroups: vi.fn(),
    joinGroup: vi.fn()
}));

const runtimeState = vi.hoisted(() => ({
    auth: {
        currentUserId: 'usr_self'
    },
    gameState: {
        isGameRunning: false
    },
    hostCapabilities: {
        registryPrefs: {
            available: true,
            reason: ''
        }
    }
}));

const toastMocks = vi.hoisted(() => ({
    error: vi.fn()
}));

const translationMocks = vi.hoisted(() => ({
    t: (key: string) => key
}));

vi.mock('@/platform/tauri/bindings', () => ({
    commands: commandMocks
}));
vi.mock('@/repositories/groupProfileRepository', () => ({
    default: repositoryMocks
}));
vi.mock('@/state/runtimeStore', () => ({
    useRuntimeStore: (selector: (state: typeof runtimeState) => unknown) =>
        selector(runtimeState)
}));
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: translationMocks.t
    })
}));
vi.mock('@/services/toastService', () => ({
    toast: {
        add: (options: AppToastOptions) => {
            switch (options.type) {
                case 'error':
                    return toastMocks.error(options);
                default:
                    throw new Error('Unhandled toast type: ' + options.type);
            }
        }
    }
}));

import { groupIdForRow } from '@/components/dialogs/user-dialog/userDialogGroupRows';
import { usePreferencesStore } from '@/state/preferencesStore';

import { useMyGroupsPageState } from './useMyGroupsPageState';

const groups = [
    { id: 'grp_a', name: 'Alpha' },
    { id: 'grp_b', name: 'Beta' }
];

describe('useMyGroupsPageState', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        runtimeState.auth.currentUserId = 'usr_self';
        runtimeState.gameState.isGameRunning = false;
        runtimeState.hostCapabilities.registryPrefs.available = true;
        runtimeState.hostCapabilities.registryPrefs.reason = '';
        usePreferencesStore.getState().patchPreferences({
            autoJoinGroupCertification: true
        });
        repositoryMocks.getUserGroups.mockResolvedValue(groups);
        repositoryMocks.joinGroup.mockResolvedValue({});
        commandMocks.appVrchatGroupOrderGet.mockResolvedValue([
            'grp_b',
            'grp_a'
        ]);
        commandMocks.appVrchatGroupOrderSet.mockResolvedValue(true);
    });

    afterEach(cleanup);

    it('shows groups in the in-game order by default', async () => {
        const { result } = renderHook(() => useMyGroupsPageState());

        await waitFor(() => {
            expect(result.current.status).toBe('ready');
            expect(result.current.visibleGroups.map(groupIdForRow)).toEqual([
                'grp_b',
                'grp_a'
            ]);
        });

        expect(result.current.sort).toBe('inGame');
    });

    it('adopts the in-game order when registry capability finishes loading', async () => {
        runtimeState.hostCapabilities.registryPrefs.available = false;
        const { result, rerender } = renderHook(() => useMyGroupsPageState());

        await waitFor(() => {
            expect(result.current.status).toBe('ready');
        });
        expect(result.current.sort).toBe('alphabetical');

        runtimeState.hostCapabilities.registryPrefs.available = true;
        rerender();

        await waitFor(() => {
            expect(result.current.sort).toBe('inGame');
            expect(result.current.visibleGroups.map(groupIdForRow)).toEqual([
                'grp_b',
                'grp_a'
            ]);
        });
    });

    it('uses edit mode as the only reorder mode', async () => {
        const { result } = renderHook(() => useMyGroupsPageState());

        await waitFor(() => {
            expect(result.current.status).toBe('ready');
        });
        expect(result.current.orderEditable).toBe(false);

        act(() => result.current.enterEditMode());
        expect(result.current.orderEditable).toBe(true);

        act(() => result.current.exitEditMode());
        expect(result.current.orderEditable).toBe(false);
    });

    it('does not auto-join when already in the developer group', async () => {
        repositoryMocks.getUserGroups.mockResolvedValue([
            ...groups,
            {
                id: 'grp_44b87c7b-00a6-4ef1-9980-0eddf3c7f06d',
                name: 'Developer'
            }
        ]);
        renderHook(() => useMyGroupsPageState());
        await waitFor(() =>
            expect(repositoryMocks.getUserGroups).toHaveBeenCalledOnce()
        );
        expect(repositoryMocks.joinGroup).not.toHaveBeenCalled();
    });

    it('does not auto-join when the setting is disabled', async () => {
        usePreferencesStore.getState().patchPreferences({
            autoJoinGroupCertification: false
        });
        renderHook(() => useMyGroupsPageState());
        await waitFor(() =>
            expect(repositoryMocks.getUserGroups).toHaveBeenCalledOnce()
        );
        expect(repositoryMocks.joinGroup).not.toHaveBeenCalled();
    });

    it('joins once and refreshes the cache when enabled', async () => {
        repositoryMocks.getUserGroups
            .mockResolvedValueOnce(groups)
            .mockResolvedValueOnce([
                ...groups,
                {
                    id: 'grp_44b87c7b-00a6-4ef1-9980-0eddf3c7f06d',
                    name: 'Developer'
                }
            ]);
        const { result } = renderHook(() => useMyGroupsPageState());
        await waitFor(() => expect(result.current.status).toBe('ready'));
        await waitFor(() =>
            expect(repositoryMocks.joinGroup).toHaveBeenCalledOnce()
        );
        expect(repositoryMocks.joinGroup).toHaveBeenCalledWith({
            groupId: 'grp_44b87c7b-00a6-4ef1-9980-0eddf3c7f06d'
        });
        expect(repositoryMocks.getUserGroups).toHaveBeenLastCalledWith({
            userId: 'usr_self',
            force: true
        });
        expect(
            result.current.groups.some(
                (group) =>
                    groupIdForRow(group) ===
                    'grp_44b87c7b-00a6-4ef1-9980-0eddf3c7f06d'
            )
        ).toBe(true);
    });

    it('swallows join failures and does not block loading', async () => {
        repositoryMocks.joinGroup.mockRejectedValueOnce(new Error('offline'));
        const { result } = renderHook(() => useMyGroupsPageState());
        await waitFor(() => expect(result.current.status).toBe('ready'));
        await waitFor(() =>
            expect(repositoryMocks.joinGroup).toHaveBeenCalledOnce()
        );
        expect(result.current.error).toBe('');
        expect(repositoryMocks.getUserGroups).toHaveBeenCalledOnce();
    });

    it('does not repeat auto-join on reload', async () => {
        const { result } = renderHook(() => useMyGroupsPageState());
        await waitFor(() => expect(result.current.status).toBe('ready'));
        await waitFor(() =>
            expect(repositoryMocks.joinGroup).toHaveBeenCalledOnce()
        );
        await act(async () => {
            await result.current.load(true);
        });
        expect(repositoryMocks.joinGroup).toHaveBeenCalledOnce();
    });

    it('does not duplicate auto-join across concurrent loads', async () => {
        let resolveFirst!: (value: typeof groups) => void;
        let resolveSecond!: (value: typeof groups) => void;
        repositoryMocks.getUserGroups
            .mockReturnValueOnce(
                new Promise((resolve) => {
                    resolveFirst = resolve;
                })
            )
            .mockReturnValueOnce(
                new Promise((resolve) => {
                    resolveSecond = resolve;
                })
            );
        const { result } = renderHook(() => useMyGroupsPageState());
        await act(async () => {
            const reload = result.current.load(true);
            resolveFirst(groups);
            resolveSecond(groups);
            await reload;
        });
        await waitFor(() =>
            expect(repositoryMocks.joinGroup).toHaveBeenCalledOnce()
        );
    });

    it('persists the order produced by a completed drag', async () => {
        commandMocks.appVrchatGroupOrderGet.mockResolvedValue([
            'grp_a',
            'grp_b'
        ]);
        const { result } = renderHook(() => useMyGroupsPageState());

        await waitFor(() => {
            expect(result.current.visibleGroups.map(groupIdForRow)).toEqual([
                'grp_a',
                'grp_b'
            ]);
        });

        act(() => result.current.enterEditMode());
        await act(async () => {
            await result.current.moveGroup('grp_b', 'grp_a');
        });

        expect(commandMocks.appVrchatGroupOrderSet).toHaveBeenCalledWith([
            'grp_b',
            'grp_a'
        ]);
        expect(result.current.visibleGroups.map(groupIdForRow)).toEqual([
            'grp_b',
            'grp_a'
        ]);
    });
});
