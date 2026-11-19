// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useUserDialogOpeningStore } from '@/state/userDialogOpeningStore';

const mocks = vi.hoisted(() => ({ prompt: vi.fn() }));

vi.mock('./useUserRelationshipRecommendationPrompt', () => ({
    useUserRelationshipRecommendationPrompt: mocks.prompt
}));

import { RelationshipRecommendationPromptHost } from './RelationshipRecommendationPromptHost';

const globalHostsSource = import.meta.glob<string>('/src/app/GlobalHosts.tsx', {
    query: '?raw',
    import: 'default',
    eager: true
})['/src/app/GlobalHosts.tsx'];

const userDialogSource = import.meta.glob<string>(
    '/src/components/dialogs/UserDialogContent.tsx',
    { query: '?raw', import: 'default', eager: true }
)['/src/components/dialogs/UserDialogContent.tsx'];

describe('RelationshipRecommendationPromptHost (M1)', () => {
    beforeEach(() => {
        mocks.prompt.mockClear();
        useUserDialogOpeningStore.setState({
            opening: { userId: '', openNonce: 0, ready: false }
        });
    });

    afterEach(() => {
        cleanup();
    });

    it('feeds the open user dialog into the prompt hook', () => {
        render(<RelationshipRecommendationPromptHost />);
        expect(mocks.prompt).toHaveBeenLastCalledWith({
            userId: '',
            openNonce: 0,
            ready: false
        });

        act(() =>
            useUserDialogOpeningStore.getState().publishUserDialogOpening({
                userId: 'usr_target',
                openNonce: 3,
                ready: true
            })
        );
        expect(mocks.prompt).toHaveBeenLastCalledWith({
            userId: 'usr_target',
            openNonce: 3,
            ready: true
        });
    });

    it('only clears the opening it published', () => {
        const store = useUserDialogOpeningStore.getState();
        store.publishUserDialogOpening({
            userId: 'usr_b',
            openNonce: 2,
            ready: true
        });
        store.clearUserDialogOpening('usr_a', 1);
        expect(useUserDialogOpeningStore.getState().opening.userId).toBe(
            'usr_b'
        );
        store.clearUserDialogOpening('usr_b', 2);
        expect(useUserDialogOpeningStore.getState().opening).toEqual({
            userId: '',
            openNonce: 0,
            ready: false
        });
    });

    it('is mounted globally and wired from the user dialog', () => {
        expect(globalHostsSource).toContain(
            '<RelationshipRecommendationPromptHost />'
        );
        expect(userDialogSource).toContain('publishUserDialogOpening({');
        expect(userDialogSource).toContain("loadStatus === 'ready'");
    });
});
