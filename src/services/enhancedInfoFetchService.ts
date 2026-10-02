import { commands } from '@/platform/tauri/bindings';
import configRepository from '@/repositories/configRepository';
import { useFriendRosterStore } from '@/state/friendRosterStore';
import { useRuntimeStore } from '@/state/runtimeStore';
import { useTrackedNonfriendsStore } from '@/state/trackedNonfriendsStore';

import { subscribeAuthenticatedRuntimeEnhancedBaseline } from './authenticatedRuntimeService';
import {
    createProfileFetchExecutor,
    type ProfileFetchDependencies,
    type ProfileFetchProgress
} from './enhancedProfileFetchExecutor';
import { fetchRawProfile } from './enhancedProfileFetchRequest';

export type EnhancedInfoFetchSource =
    | 'startup'
    | 'reconnect'
    | 'periodic'
    | 'manual'
    | 'profile';
export type EnhancedInfoFetchSnapshot = Omit<
    ProfileFetchProgress,
    'nextRunAt'
> & {
    accountId: string | null;
    running: boolean;
    source: EnhancedInfoFetchSource;
    phase:
        | 'idle'
        | 'fetching'
        | 'relationships'
        | 'paused'
        | 'completed'
        | 'cancelled'
        | 'error';
    nextRunAt: string | null;
    errorMessage: string | null;
};
const emptySnapshot = (): EnhancedInfoFetchSnapshot => ({
    accountId: null,
    running: false,
    source: 'startup',
    phase: 'idle',
    currentTarget: null,
    total: 0,
    processed: 0,
    succeeded: 0,
    unchanged: 0,
    failed: 0,
    incomplete: 0,
    bioUpdated: 0,
    statusUpdated: 0,
    pauseReason: null,
    nextRunAt: null,
    errorMessage: null
});
let snapshot = emptySnapshot();
const listeners = new Set<(snapshot: EnhancedInfoFetchSnapshot) => void>();
let active: {
    controller: AbortController;
    promise: Promise<void>;
    scope: string;
} | null = null;
type Recommendations = (context: {
    accountId: string;
    signal: AbortSignal;
}) => Promise<void>;
let recommendations: Recommendations | null = null;
function publish(patch: Partial<EnhancedInfoFetchSnapshot>): void {
    snapshot = { ...snapshot, ...patch };
    for (const listener of listeners) listener(snapshot);
}
export function getEnhancedInfoFetchSnapshot(): EnhancedInfoFetchSnapshot {
    return snapshot;
}
export function subscribeEnhancedInfoFetch(
    listener: (snapshot: EnhancedInfoFetchSnapshot) => void
): () => void {
    listeners.add(listener);
    listener(snapshot);
    return () => listeners.delete(listener);
}
export function registerEnhancedRelationshipRecommendations(
    executor: Recommendations
): () => void {
    recommendations = executor;
    return () => {
        if (recommendations === executor) recommendations = null;
    };
}
function currentScope(): string {
    const state = useRuntimeStore.getState();
    const session = state.authenticatedSession.session;
    return JSON.stringify([
        state.auth.currentUserId,
        session?.authScopeGeneration,
        session?.endpoint
    ]);
}
export function cancelEnhancedInfoFetch(): void {
    active?.controller.abort();
    if (active)
        publish({ phase: 'cancelled', pauseReason: null, nextRunAt: null });
}
export function waitForEnhancedFetch(
    milliseconds: number,
    signal: AbortSignal
): Promise<void> {
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
        const onAbort = () => {
            clearTimeout(timer);
            signal.removeEventListener('abort', onAbort);
            reject(new DOMException('Enhanced fetch cancelled.', 'AbortError'));
        };
        const timer = setTimeout(() => {
            signal.removeEventListener('abort', onAbort);
            resolve();
        }, milliseconds);
        signal.addEventListener('abort', onAbort, { once: true });
    });
}
export function runEnhancedInfoFetch(
    source: EnhancedInfoFetchSource = 'manual'
): Promise<void> {
    const accountId = useRuntimeStore.getState().auth.currentUserId;
    const scope = currentScope();
    if (active?.scope === scope && !active.controller.signal.aborted)
        return active.promise;
    if (active) cancelEnhancedInfoFetch();
    if (!accountId) return Promise.resolve();
    const controller = new AbortController();
    const token = { controller, scope, promise: Promise.resolve() };
    active = token;
    snapshot = {
        ...emptySnapshot(),
        accountId,
        source,
        running: true,
        phase: 'fetching'
    };
    publish({});
    const isCurrent = () =>
        !controller.signal.aborted && currentScope() === scope;
    const dependencies: ProfileFetchDependencies = {
        getFriends: () => useFriendRosterStore.getState().friendsById,
        isAccountCurrent: () =>
            isCurrent() &&
            useFriendRosterStore.getState().currentUserId === accountId &&
            useFriendRosterStore.getState().loadStatus === 'ready',
        loadTracked: (id) => useTrackedNonfriendsStore.getState().load(id),
        getTracked: () => useTrackedNonfriendsStore.getState(),
        getUserProfile: fetchRawProfile,
        reconcile: commands.appProfileFeedReconcile,
        updateName: (id, userId, name) =>
            useTrackedNonfriendsStore.getState().updateName(id, userId, name),
        wait: waitForEnhancedFetch
    };
    token.promise = (async () => {
        try {
            const outcome = await createProfileFetchExecutor(dependencies)({
                accountId,
                signal: controller.signal,
                translate: (key) => key,
                onProfileProgress: (progress) => {
                    if (active === token && isCurrent())
                        publish({
                            ...progress,
                            phase: progress.pauseReason ? 'paused' : 'fetching'
                        });
                }
            });
            if (!isCurrent() || outcome?.status === 'skipped') {
                if (active === token)
                    publish({
                        phase:
                            isCurrent() &&
                            outcome?.status === 'skipped' &&
                            outcome.skipReason ===
                                'workflow.skip.profile_fetch_empty'
                                ? 'completed'
                                : 'cancelled'
                    });
                return;
            }
            if (recommendations) {
                publish({ phase: 'relationships', currentTarget: null });
                await recommendations({ accountId, signal: controller.signal });
            }
            if (active === token && isCurrent())
                publish({ phase: 'completed' });
        } catch (error) {
            if (active === token)
                publish({
                    phase: !isCurrent() ? 'cancelled' : 'error',
                    errorMessage: !isCurrent()
                        ? null
                        : error instanceof Error
                          ? error.message
                          : String(error)
                });
        } finally {
            if (active === token) {
                active = null;
                publish({
                    running: false,
                    currentTarget: null,
                    pauseReason: null,
                    nextRunAt: null
                });
            }
        }
    })();
    return token.promise;
}

/** Called by main, not a dialog. Automatic sweeps follow completed native
 * friend baseline revisions; no timer assumes an hourly refresh finished. */
export function initializeEnhancedInfoFetch(): () => void {
    let disposed = false;
    const unsubscribeBaseline = subscribeAuthenticatedRuntimeEnhancedBaseline(
        (accountId, source) => {
            const baselineScope = currentScope();
            // Deliberately lazy: bootstrap owns configuration initialization. A
            // read failure is contained here and must never reject app bootstrap.
            void configRepository
                .getBool('enhancedInfoFetchEnabled', true)
                .then((enabled) => {
                    if (
                        !disposed &&
                        enabled &&
                        currentScope() === baselineScope &&
                        useRuntimeStore.getState().auth.currentUserId ===
                            accountId
                    )
                        return runEnhancedInfoFetch(source);
                })
                .catch((error: unknown) =>
                    console.warn(
                        'Enhanced fetch automatic trigger failed:',
                        error
                    )
                );
        }
    );
    const unsubscribeRuntime = useRuntimeStore.subscribe(() => {
        if (active && currentScope() !== active.scope) {
            cancelEnhancedInfoFetch();
            snapshot = {
                ...emptySnapshot(),
                accountId: useRuntimeStore.getState().auth.currentUserId,
                phase: 'cancelled'
            };
            publish({});
        }
    });
    return () => {
        disposed = true;
        unsubscribeBaseline();
        unsubscribeRuntime();
        cancelEnhancedInfoFetch();
    };
}
