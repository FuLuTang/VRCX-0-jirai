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

const configMocks = vi.hoisted(() => ({
    getBool: vi.fn(),
    setBool: vi.fn()
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

vi.mock('@/platform/tauri/bindings', () => ({
    commands: commandMocks
}));
vi.mock('@/repositories/groupProfileRepository', () => ({
    default: repositoryMocks
}));
vi.mock('@/repositories/configRepository', () => ({
    default: configMocks
}));
vi.mock('@/state/runtimeStore', () => ({
    useRuntimeStore: (selector: (state: typeof runtimeState) => unknown) =>
        selector(runtimeState)
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
import { useMyGroupsRevisionStore } from '@/state/myGroupsRevisionStore';
import { usePreferencesStore } from '@/state/preferencesStore';

import { useMyGroupsPageState } from './useMyGroupsPageState';

const groups = [
    { id: 'grp_a', name: 'Alpha' },
    { id: 'grp_b', name: 'Beta' }
];

describe('useMyGroupsPageState', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        useMyGroupsRevisionStore.setState({ revision: 0 });
        runtimeState.auth.currentUserId = 'usr_self';
        runtimeState.gameState.isGameRunning = false;
        runtimeState.hostCapabilities.registryPrefs.available = true;
        runtimeState.hostCapabilities.registryPrefs.reason = '';
        usePreferencesStore.getState().hydratePreferences({
            autoJoinGroupCertification: true
        });
        repositoryMocks.getUserGroups.mockResolvedValue(groups);
        repositoryMocks.joinGroup.mockResolvedValue({});
        commandMocks.appVrchatGroupOrderGet.mockResolvedValue([
            'grp_b',
            'grp_a'
        ]);
        commandMocks.appVrchatGroupOrderSet.mockResolvedValue(true);
        configMocks.getBool.mockImplementation(
            async (_key: string, defaultValue: boolean) => defaultValue
        );
        configMocks.setBool.mockResolvedValue(null);
    });

    afterEach(cleanup);

    it('reloads fresh groups after a group changes outside the page', async () => {
        const { result } = renderHook(() => useMyGroupsPageState());
        await waitFor(() => {
            expect(result.current.visibleGroups).toHaveLength(2);
        });
        repositoryMocks.getUserGroups.mockResolvedValue([groups[1]]);

        act(() => {
            useMyGroupsRevisionStore.getState().bumpRevision();
        });

        await waitFor(() => {
            expect(result.current.visibleGroups.map(groupIdForRow)).toEqual([
                'grp_b'
            ]);
        });
        expect(repositoryMocks.getUserGroups).toHaveBeenLastCalledWith({
            userId: 'usr_self',
            force: true
        });
    });

    it('loads fresh groups when opened after a group changed elsewhere', async () => {
        useMyGroupsRevisionStore.getState().bumpRevision();

        const { result } = renderHook(() => useMyGroupsPageState());

        await waitFor(() => {
            expect(result.current.status).toBe('ready');
        });
        expect(repositoryMocks.getUserGroups).toHaveBeenCalledWith({
            userId: 'usr_self',
            force: true
        });
    });

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

    it('reorders only in edit mode, which restores the in-game order view', async () => {
        const { result } = renderHook(() => useMyGroupsPageState());

        await waitFor(() => {
            expect(result.current.status).toBe('ready');
        });
        await act(async () => {
            await result.current.moveGroup('grp_a', 'grp_b');
        });
        expect(commandMocks.appVrchatGroupOrderSet).not.toHaveBeenCalled();

        act(() => {
            result.current.setSearch('alp');
            result.current.setSort('alphabetical');
        });
        act(() => result.current.enterEditMode());

        expect(result.current.orderEditable).toBe(true);
        expect(result.current.search).toBe('');
        expect(result.current.sort).toBe('inGame');

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

    it('waits for preferences hydration before default auto-join', async () => {
        usePreferencesStore.setState({ preferencesHydrated: false });
        renderHook(() => useMyGroupsPageState());
        await waitFor(() =>
            expect(repositoryMocks.getUserGroups).toHaveBeenCalledOnce()
        );
        expect(repositoryMocks.joinGroup).not.toHaveBeenCalled();
    });

    it('does not join from a stale account group response', async () => {
        let resolveOld!: (value: typeof groups) => void;
        repositoryMocks.getUserGroups
            .mockReturnValueOnce(
                new Promise((resolve) => {
                    resolveOld = resolve;
                })
            )
            .mockResolvedValueOnce(groups);
        const { rerender } = renderHook(() => useMyGroupsPageState());
        runtimeState.auth.currentUserId = 'usr_other';
        rerender();
        await act(async () => resolveOld(groups));
        await waitFor(() =>
            expect(repositoryMocks.joinGroup).toHaveBeenCalledOnce()
        );
        expect(repositoryMocks.getUserGroups).toHaveBeenCalledWith({
            userId: 'usr_other',
            force: false
        });
    });

    it('does not refresh the old account after an in-flight join', async () => {
        let finishOldJoin!: () => void;
        repositoryMocks.joinGroup.mockReturnValueOnce(
            new Promise((resolve) => {
                finishOldJoin = () => resolve({});
            })
        );
        const { rerender } = renderHook(() => useMyGroupsPageState());
        await waitFor(() =>
            expect(repositoryMocks.joinGroup).toHaveBeenCalledOnce()
        );
        runtimeState.auth.currentUserId = 'usr_other';
        rerender();
        await waitFor(() =>
            expect(repositoryMocks.joinGroup).toHaveBeenCalledTimes(2)
        );
        await act(async () => finishOldJoin());
        expect(repositoryMocks.getUserGroups).not.toHaveBeenCalledWith({
            userId: 'usr_self',
            force: true
        });
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

    it('splits own and joined groups into sections', async () => {
        repositoryMocks.getUserGroups.mockResolvedValue([
            { id: 'grp_a', name: 'Alpha', ownerId: 'usr_self' },
            { id: 'grp_b', name: 'Beta', ownerId: 'usr_other' }
        ]);
        const { result } = renderHook(() => useMyGroupsPageState());

        await waitFor(() => {
            expect(
                result.current.sections.map((section) => ({
                    key: section.key,
                    ids: section.groups.map(groupIdForRow)
                }))
            ).toEqual([
                { key: 'own', ids: ['grp_a'] },
                { key: 'joined', ids: ['grp_b'] }
            ]);
        });
    });

    it('restores and persists collapsed sections', async () => {
        configMocks.getBool.mockImplementation(async (key: string) =>
            key === 'VRCX_MyGroupsJoinedSectionOpen' ? false : true
        );
        repositoryMocks.getUserGroups.mockResolvedValue([
            { id: 'grp_a', name: 'Alpha', ownerId: 'usr_self' },
            { id: 'grp_b', name: 'Beta', ownerId: 'usr_other' }
        ]);
        const { result } = renderHook(() => useMyGroupsPageState());

        const openState = () =>
            result.current.sections.map((section) => [
                section.key,
                section.open
            ]);

        await waitFor(() => {
            expect(openState()).toEqual([
                ['own', true],
                ['joined', false]
            ]);
        });

        act(() => result.current.toggleSection('own'));

        expect(configMocks.setBool).toHaveBeenCalledWith(
            'VRCX_MyGroupsOwnSectionOpen',
            false
        );
        expect(openState()).toEqual([
            ['own', false],
            ['joined', false]
        ]);
    });
});
