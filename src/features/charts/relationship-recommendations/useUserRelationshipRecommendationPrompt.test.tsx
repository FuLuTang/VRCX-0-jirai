// @vitest-environment jsdom

import { act, cleanup, render, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RelationshipSuggestion } from '../relationshipRecommendationsAlgorithm';

type ToastOptions = {
    type: string;
    title?: unknown;
    description?: ReactNode;
    timeout?: number;
    position?: string;
};

const mocks = vi.hoisted(() => ({
    auth: { currentUserId: 'usr_me', generation: 7 as number | null },
    accounts: {} as Record<string, unknown>,
    confirm: vi.fn(),
    ignore: vi.fn(),
    toastAdd: vi.fn(),
    toastClose: vi.fn(),
    listeners: new Set<() => void>()
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

vi.mock('@/state/runtimeStore', async () => {
    const { useSyncExternalStore } = await import('react');
    const snapshot = () => ({
        auth: { currentUserId: mocks.auth.currentUserId },
        authenticatedSession: {
            session:
                mocks.auth.generation == null
                    ? null
                    : { authScopeGeneration: mocks.auth.generation }
        }
    });
    return {
        useRuntimeStore: <T,>(
            selector: (state: ReturnType<typeof snapshot>) => T
        ) =>
            useSyncExternalStore(
                (listener) => {
                    mocks.listeners.add(listener);
                    return () => mocks.listeners.delete(listener);
                },
                () => selector(snapshot())
            )
    };
});

vi.mock(
    '@/features/charts/relationship-recommendations/relationshipRecommendationsService',
    async () => {
        const { useSyncExternalStore } = await import('react');
        return {
            confirmRelationshipRecommendation: mocks.confirm,
            ignoreRelationshipRecommendation: mocks.ignore,
            useRelationshipRecommendations: <T,>(
                selector: (state: { accounts: typeof mocks.accounts }) => T
            ) =>
                useSyncExternalStore(
                    (listener) => {
                        mocks.listeners.add(listener);
                        return () => mocks.listeners.delete(listener);
                    },
                    () => selector({ accounts: mocks.accounts })
                )
        };
    }
);

vi.mock('@/services/toastService', () => ({
    toast: { add: mocks.toastAdd, close: mocks.toastClose }
}));

import { useUserRelationshipRecommendationPrompt } from './useUserRelationshipRecommendationPrompt';

function suggestion(
    overrides: Partial<RelationshipSuggestion> = {}
): RelationshipSuggestion {
    return {
        userIdA: 'usr_target',
        userIdB: 'usr_other',
        nameA: 'Target',
        nameB: 'Other Player',
        score: 1,
        displayScore: '1',
        tooltip: '',
        key: 'usr_other|usr_target',
        isAdded: false,
        ...overrides
    };
}

function setRecommendations(
    suggestions: RelationshipSuggestion[],
    ignored: string[] = [],
    generation: number | null = 7
) {
    mocks.accounts = {
        usr_me: {
            generation,
            suggestions,
            ignored: new Set(ignored),
            computing: false,
            error: '',
            progress: null
        }
    };
}

function notify() {
    for (const listener of mocks.listeners) {
        listener();
    }
}

let toastCount = 0;

function lastToast(): ToastOptions {
    return mocks.toastAdd.mock.calls.at(-1)?.[0] as ToastOptions;
}

function renderPrompt(
    props: { userId?: string; openNonce?: number; ready?: boolean } = {}
) {
    return renderHook(
        ({ userId, openNonce, ready }) =>
            useUserRelationshipRecommendationPrompt({
                userId,
                openNonce,
                ready
            }),
        {
            initialProps: {
                userId: props.userId ?? 'usr_target',
                openNonce: props.openNonce ?? 1,
                ready: props.ready ?? true
            }
        }
    );
}

function clickToastButton(label: string) {
    const view = render(<>{lastToast().description}</>);
    const button = Array.from(view.container.querySelectorAll('button')).find(
        (node) => node.textContent === label
    );
    if (!button) {
        throw new Error(`button ${label} not found`);
    }
    return { button, view };
}

describe('useUserRelationshipRecommendationPrompt (M1, #3b)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.auth = { currentUserId: 'usr_me', generation: 7 };
        toastCount = 0;
        mocks.toastAdd.mockImplementation(() => {
            toastCount += 1;
            return `toast-${toastCount}`;
        });
        mocks.confirm.mockResolvedValue(undefined);
        mocks.ignore.mockResolvedValue(undefined);
        setRecommendations([suggestion()]);
    });

    afterEach(() => {
        cleanup();
        mocks.listeners.clear();
    });

    it('asks once about a pending recommendation that involves the player (A3b-P1)', () => {
        renderPrompt();
        expect(mocks.toastAdd).toHaveBeenCalledTimes(1);
        const options = lastToast();
        expect(options).toMatchObject({
            type: 'info',
            position: 'bottom-right',
            title: 'jirai.relationship_recommendations.prompt_title'
        });
        const view = render(<>{options.description}</>);
        expect(view.container.textContent).toContain(
            'jirai.relationship_recommendations.prompt_question:Other Player'
        );
    });

    it('names the other side when the player is userIdB (A3b-P1)', () => {
        setRecommendations([
            suggestion({
                userIdA: 'usr_other',
                userIdB: 'usr_target',
                nameA: 'Other A',
                nameB: 'Target'
            })
        ]);
        renderPrompt();
        const view = render(<>{lastToast().description}</>);
        expect(view.container.textContent).toContain('prompt_question:Other A');
    });

    it('asks only one question per opening and asks again on a new openNonce (A3b-P2)', () => {
        setRecommendations([
            suggestion(),
            suggestion({
                userIdB: 'usr_third',
                nameB: 'Third',
                key: 'usr_target|usr_third'
            })
        ]);
        const hook = renderPrompt();
        hook.rerender({ userId: 'usr_target', openNonce: 1, ready: true });
        act(() => notify());
        expect(mocks.toastAdd).toHaveBeenCalledTimes(1);

        hook.rerender({ userId: 'usr_target', openNonce: 2, ready: true });
        expect(mocks.toastAdd).toHaveBeenCalledTimes(2);
        expect(mocks.toastClose).toHaveBeenCalledWith('toast-1');
    });

    it('"is a friend" confirms the recommendation and closes the prompt (A3b-P3)', async () => {
        renderPrompt();
        const { button } = clickToastButton(
            'jirai.relationship_recommendations.prompt_yes'
        );
        await act(async () => {
            button.click();
        });
        expect(mocks.confirm).toHaveBeenCalledWith('usr_me', suggestion());
        expect(mocks.ignore).not.toHaveBeenCalled();
        expect(mocks.toastClose).toHaveBeenCalledWith('toast-1');
    });

    it('"ignore" ignores the recommendation and closes the prompt (A3b-P3)', async () => {
        renderPrompt();
        const { button } = clickToastButton(
            'jirai.relationship_recommendations.prompt_ignore'
        );
        await act(async () => {
            button.click();
        });
        expect(mocks.ignore).toHaveBeenCalledWith(
            'usr_me',
            'usr_other|usr_target'
        );
        expect(mocks.confirm).not.toHaveBeenCalled();
        expect(mocks.toastClose).toHaveBeenCalledWith('toast-1');
    });

    it('closes automatically after 6 seconds (A3b-P4)', () => {
        renderPrompt();
        expect(lastToast().timeout).toBe(6000);
    });

    it('closes the old prompt when the account or login generation changes (A3b-P4)', () => {
        const hook = renderPrompt();
        expect(mocks.toastAdd).toHaveBeenCalledTimes(1);

        mocks.auth.generation = 8;
        act(() => notify());
        hook.rerender({ userId: 'usr_target', openNonce: 1, ready: true });
        expect(mocks.toastClose).toHaveBeenCalledWith('toast-1');

        mocks.auth = { currentUserId: 'usr_someone_else', generation: 8 };
        act(() => notify());
        expect(mocks.toastAdd).toHaveBeenCalledTimes(1);
    });

    it('does not ask before the profile is ready, then asks once ready (A3b-P5)', () => {
        const hook = renderPrompt({ ready: false });
        expect(mocks.toastAdd).not.toHaveBeenCalled();
        hook.rerender({ userId: 'usr_target', openNonce: 1, ready: true });
        expect(mocks.toastAdd).toHaveBeenCalledTimes(1);
    });

    it.each([
        ['own profile', () => renderPrompt({ userId: 'usr_me' })],
        [
            'no recommendation',
            () => {
                setRecommendations([]);
                return renderPrompt();
            }
        ],
        [
            'recommendation for other players only',
            () => {
                setRecommendations([
                    suggestion({
                        userIdA: 'usr_x',
                        userIdB: 'usr_y',
                        key: 'x|y'
                    })
                ]);
                return renderPrompt();
            }
        ],
        [
            'already confirmed',
            () => {
                setRecommendations([suggestion({ isAdded: true })]);
                return renderPrompt();
            }
        ],
        [
            'already ignored',
            () => {
                setRecommendations([suggestion()], ['usr_other|usr_target']);
                return renderPrompt();
            }
        ],
        [
            'recommendations from another login generation',
            () => {
                setRecommendations([suggestion()], [], 6);
                return renderPrompt();
            }
        ]
    ])('does not ask for %s (A3b-P5)', (_name, run) => {
        run();
        expect(mocks.toastAdd).not.toHaveBeenCalled();
    });
});

const localeSources = import.meta.glob<string>(
    ['/src/localization/en.json', '/src/localization/zh-CN.json'],
    { query: '?raw', import: 'default', eager: true }
);

describe('relationship prompt copy (A3b-P6)', () => {
    it.each(['en', 'zh-CN'])('%s has the four prompt keys', (language) => {
        const messages = JSON.parse(
            localeSources[`/src/localization/${language}.json`]
        ) as {
            jirai: { relationship_recommendations: Record<string, string> };
        };
        const copy = messages.jirai.relationship_recommendations;
        for (const key of [
            'prompt_title',
            'prompt_question',
            'prompt_yes',
            'prompt_ignore'
        ]) {
            expect(copy[key], key).toBeTruthy();
        }
        expect(copy.prompt_question).toContain('{name}');
    });
});
