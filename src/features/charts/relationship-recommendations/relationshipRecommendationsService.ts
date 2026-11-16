import { create } from 'zustand';

import { commands } from '@/platform/tauri/bindings';
import mutualGraphPersistenceRepository from '@/repositories/mutualGraphPersistenceRepository';
import { registerEnhancedRelationshipRecommendations } from '@/services/enhancedInfoFetchService';
import { useMutualGraphRevisionStore } from '@/state/mutualGraphRevisionStore';
import { useRuntimeStore } from '@/state/runtimeStore';

import {
    computeRelationshipSuggestions,
    type RelationshipSuggestion
} from '../relationshipRecommendationsAlgorithm';
import { loadRecommendationInput } from './relationshipRecommendationData';

type AccountRecommendations = {
    generation: number | null;
    suggestions: RelationshipSuggestion[];
    ignored: Set<string>;
    computing: boolean;
    error: string;
    progress: { done: number; total: number; step: string } | null;
};
const empty = (): AccountRecommendations => ({
    generation: null,
    suggestions: [],
    ignored: new Set(),
    computing: false,
    error: '',
    progress: null
});
export const useRelationshipRecommendations = create<{
    accounts: Record<string, AccountRecommendations>;
}>(() => ({ accounts: {} }));
export function getAccountRecommendations(accountId: string) {
    return useRelationshipRecommendations.getState().accounts[accountId];
}
function patch(accountId: string, update: Partial<AccountRecommendations>) {
    useRelationshipRecommendations.setState((state) => ({
        accounts: {
            ...state.accounts,
            [accountId]: {
                ...(state.accounts[accountId] || empty()),
                ...update
            }
        }
    }));
}
const runs = new Map<string, AbortController>();
export type RecommendationExecutionContext = {
    accountId: string;
    signal: AbortSignal;
};
async function publish(accountId: string) {
    const state = getAccountRecommendations(accountId);
    const runtime = useRuntimeStore.getState();
    if (
        runtime.auth.currentUserId !== accountId ||
        state?.generation == null ||
        runtime.authenticatedSession.session?.authScopeGeneration !==
            state.generation
    )
        return;
    await commands.appRelationshipRecommendationsSet(
        accountId,
        state.generation,
        (state?.suggestions || [])
            .filter((row) => !row.isAdded && !state?.ignored.has(row.key))
            .map(({ userIdA, userIdB, nameA, nameB, score }) => ({
                userIdA,
                userIdB,
                nameA,
                nameB,
                score
            }))
    );
}
export async function calculateRelationshipRecommendations(
    context: RecommendationExecutionContext
) {
    const { accountId, signal } = context;
    const generation =
        useRuntimeStore.getState().authenticatedSession.session
            ?.authScopeGeneration;
    if (
        !accountId ||
        generation == null ||
        useRuntimeStore.getState().auth.currentUserId !== accountId
    )
        throw new DOMException('Account changed', 'AbortError');
    runs.get(accountId)?.abort();
    const controller = new AbortController();
    runs.set(accountId, controller);
    const cancel = () => controller.abort();
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) controller.abort();
    patch(accountId, { computing: true, error: '', progress: null });
    try {
        const input = await loadRecommendationInput(
            accountId,
            controller.signal
        );
        input.onProgress = (progress) => patch(accountId, { progress });
        const suggestions = await computeRelationshipSuggestions(input);
        controller.signal.throwIfAborted();
        if (
            useRuntimeStore.getState().auth.currentUserId !== accountId ||
            useRuntimeStore.getState().authenticatedSession.session
                ?.authScopeGeneration !== generation
        )
            throw new DOMException('Account changed', 'AbortError');
        patch(accountId, { suggestions, generation });
        await publish(accountId);
    } catch (error) {
        if (!controller.signal.aborted)
            patch(accountId, {
                error: error instanceof Error ? error.message : String(error)
            });
        throw error;
    } finally {
        signal.removeEventListener('abort', cancel);
        if (runs.get(accountId) === controller) {
            runs.delete(accountId);
            patch(accountId, { computing: false });
        }
    }
}
export async function confirmRelationshipRecommendation(
    accountId: string,
    row: RelationshipSuggestion
) {
    const generation = getAccountRecommendations(accountId)?.generation;
    if (
        generation == null ||
        useRuntimeStore.getState().auth.currentUserId !== accountId ||
        useRuntimeStore.getState().authenticatedSession.session
            ?.authScopeGeneration !== generation
    )
        return;
    await mutualGraphPersistenceRepository.setManualLink(
        accountId,
        row.userIdA,
        row.userIdB,
        true
    );
    if (
        useRuntimeStore.getState().auth.currentUserId !== accountId ||
        useRuntimeStore.getState().authenticatedSession.session
            ?.authScopeGeneration !== generation
    )
        return;
    patch(accountId, {
        suggestions: (
            getAccountRecommendations(accountId)?.suggestions || []
        ).map((value) =>
            value.key === row.key ? { ...value, isAdded: true } : value
        )
    });
    useMutualGraphRevisionStore.getState().bumpRevision(accountId);
    await publish(accountId);
}
export async function ignoreRelationshipRecommendation(
    accountId: string,
    key: string
) {
    if (
        useRuntimeStore.getState().auth.currentUserId !== accountId ||
        useRuntimeStore.getState().authenticatedSession.session
            ?.authScopeGeneration !==
            getAccountRecommendations(accountId)?.generation
    )
        return;
    const ignored = new Set(getAccountRecommendations(accountId)?.ignored);
    ignored.add(key);
    patch(accountId, { ignored });
    await publish(accountId);
}
export function initializeRelationshipRecommendations(): () => void {
    const unregister = registerEnhancedRelationshipRecommendations(
        calculateRelationshipRecommendations
    );
    const unsubscribe = useRuntimeStore.subscribe((state, previous) => {
        if (
            state.auth.currentUserId === previous.auth.currentUserId &&
            state.authenticatedSession.session?.authScopeGeneration ===
                previous.authenticatedSession.session?.authScopeGeneration
        )
            return;
        for (const run of runs.values()) run.abort();
        if (previous.auth.currentUserId)
            patch(previous.auth.currentUserId, {
                suggestions: [],
                generation: null,
                error: '',
                progress: null
            });
    });
    return () => {
        unregister();
        unsubscribe();
        for (const run of runs.values()) run.abort();
    };
}
