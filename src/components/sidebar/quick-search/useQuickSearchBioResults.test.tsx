// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { QuickSearchState } from '../quickSearch';

const mocks = vi.hoisted(() => ({
    loadQuickSearchResults: vi.fn()
}));

vi.mock('@/state/runtimeStore', () => ({
    useRuntimeStore: (
        selector: (state: {
            groupInstances: {
                endpoint: string;
                instances: unknown[];
                userId: string;
            };
        }) => unknown
    ) =>
        selector({
            groupInstances: { endpoint: '', instances: [], userId: '' }
        })
}));

vi.mock('../quickSearch', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../quickSearch')>();
    return {
        ...actual,
        loadQuickSearchResults: mocks.loadQuickSearchResults
    };
});

import { createEmptyQuickSearchState } from '../quickSearch';
import { useQuickSearchResults } from './useQuickSearchResults';

function deferredResults() {
    let resolve!: (state: QuickSearchState) => void;
    const promise = new Promise<QuickSearchState>((nextResolve) => {
        resolve = nextResolve;
    });
    return { promise, resolve };
}

function bioFriendState(id: string, bio: string): QuickSearchState {
    return {
        ...createEmptyQuickSearchState('ready'),
        friends: [
            {
                id,
                type: 'friend',
                source: 'friends',
                name: id,
                subtitle: '',
                imageUrl: '',
                seedData: null,
                memo: '',
                note: '',
                bio,
                matchedField: 'bio',
                userColour: ''
            }
        ]
    };
}

describe('useQuickSearchResults bio results (#14, A14-5)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mocks.loadQuickSearchResults.mockReset();
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    it('does not let a stale bio result overwrite the newer query result', async () => {
        const first = deferredResults();
        const second = deferredResults();
        mocks.loadQuickSearchResults
            .mockReturnValueOnce(first.promise)
            .mockReturnValueOnce(second.promise);
        const { result, rerender } = renderHook(
            ({ normalizedQuery }) =>
                useQuickSearchResults({
                    currentUserId: 'usr_current',
                    currentEndpoint: 'https://example.test',
                    normalizedQuery,
                    open: true
                }),
            { initialProps: { normalizedQuery: 'kyoto' } }
        );
        await act(() => vi.advanceTimersByTimeAsync(250));
        rerender({ normalizedQuery: 'osaka' });
        await act(() => vi.advanceTimersByTimeAsync(250));

        await act(async () => {
            second.resolve(bioFriendState('usr_osaka', 'osaka fan'));
            await second.promise;
        });
        await act(async () => {
            first.resolve(bioFriendState('usr_kyoto', 'kyoto fan'));
            await first.promise;
        });

        expect(result.current.friends.map((row) => row.id)).toEqual([
            'usr_osaka'
        ]);
        expect(result.current.friends[0].matchedField).toBe('bio');
        expect(mocks.loadQuickSearchResults).toHaveBeenNthCalledWith(
            2,
            'osaka'
        );
    });
});
