// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { QuickSearchResult } from '../quickSearch';

const mocks = vi.hoisted(() => ({ recent: vi.fn() }));

vi.mock('@/platform/tauri/bindings', () => ({
    commands: { appQuickSearchRecent: mocks.recent }
}));

import {
    filterQuickSearchRecent,
    useQuickSearchRecent
} from './useQuickSearchRecent';

function row(
    id: string,
    name: string,
    type: QuickSearchResult['type']
): QuickSearchResult {
    return {
        id,
        type,
        source: type === 'world' ? 'recentlyJoined' : 'recentlyMet',
        name,
        subtitle: '',
        imageUrl: '',
        seedData: null,
        memo: '',
        note: '',
        matchedField: 'name',
        userColour: ''
    };
}

const recent = {
    metUsers: [
        row('usr_1', 'Kyoto Walker', 'friend'),
        row('usr_2', 'Osaka', 'friend')
    ],
    joinedWorlds: [
        row('wrld_1', 'KYOTO Garden', 'world'),
        row('wrld_2', 'Tokyo Night', 'world')
    ]
};

describe('quick search recent groups (M3, #17)', () => {
    beforeEach(() => {
        mocks.recent.mockReset();
    });

    afterEach(() => {
        cleanup();
    });

    // A17-4
    it('filters both groups by case-insensitive name containment', () => {
        const filtered = filterQuickSearchRecent(recent, 'kyoto');
        expect(filtered.metUsers.map((item) => item.id)).toEqual(['usr_1']);
        expect(filtered.joinedWorlds.map((item) => item.id)).toEqual([
            'wrld_1'
        ]);
        expect(filterQuickSearchRecent(recent, '')).toBe(recent);
        expect(filterQuickSearchRecent(recent, 'zzz')).toEqual({
            metUsers: [],
            joinedWorlds: []
        });
    });

    it('loads once per opening and filters locally while typing', async () => {
        mocks.recent.mockResolvedValue({
            status: 'ready',
            detail: '',
            metUsers: recent.metUsers,
            joinedWorlds: recent.joinedWorlds
        });
        const { result, rerender } = renderHook(
            ({ normalizedQuery, open }) =>
                useQuickSearchRecent({
                    currentUserId: 'usr_me',
                    currentEndpoint: 'https://example.test',
                    normalizedQuery,
                    open
                }),
            { initialProps: { normalizedQuery: '', open: true } }
        );
        await act(async () => {});
        expect(result.current.metUsers).toHaveLength(2);
        expect(result.current.joinedWorlds).toHaveLength(2);

        rerender({ normalizedQuery: 'tokyo', open: true });
        expect(result.current.joinedWorlds.map((item) => item.id)).toEqual([
            'wrld_2'
        ]);
        expect(mocks.recent).toHaveBeenCalledTimes(1);

        rerender({ normalizedQuery: '', open: false });
        expect(result.current).toEqual({ metUsers: [], joinedWorlds: [] });
        rerender({ normalizedQuery: '', open: true });
        await act(async () => {});
        expect(mocks.recent).toHaveBeenCalledTimes(2);
    });

    it('stays empty when loading fails or there is no account', async () => {
        mocks.recent.mockRejectedValue(new Error('db'));
        const failed = renderHook(() =>
            useQuickSearchRecent({
                currentUserId: 'usr_me',
                normalizedQuery: '',
                open: true
            })
        );
        await act(async () => {});
        expect(failed.result.current).toEqual({
            metUsers: [],
            joinedWorlds: []
        });

        mocks.recent.mockClear();
        renderHook(() =>
            useQuickSearchRecent({
                currentUserId: null,
                normalizedQuery: '',
                open: true
            })
        );
        await act(async () => {});
        expect(mocks.recent).not.toHaveBeenCalled();
    });

    it('drops results that belong to the previous account', async () => {
        let resolveFirst!: (value: unknown) => void;
        mocks.recent
            .mockReturnValueOnce(
                new Promise((resolve) => {
                    resolveFirst = resolve;
                })
            )
            .mockResolvedValueOnce({
                status: 'ready',
                detail: '',
                metUsers: [row('usr_second', 'Second', 'friend')],
                joinedWorlds: []
            });
        const { result, rerender } = renderHook(
            ({ currentUserId }) =>
                useQuickSearchRecent({
                    currentUserId,
                    normalizedQuery: '',
                    open: true
                }),
            { initialProps: { currentUserId: 'usr_first' } }
        );
        rerender({ currentUserId: 'usr_second' });
        await act(async () => {});
        await act(async () => {
            resolveFirst({
                status: 'ready',
                detail: '',
                metUsers: [row('usr_first_met', 'First', 'friend')],
                joinedWorlds: []
            });
        });
        expect(result.current.metUsers.map((item) => item.id)).toEqual([
            'usr_second'
        ]);
    });
});
