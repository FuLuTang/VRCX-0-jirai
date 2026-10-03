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

export type EnhancedInfoFetchSource = 'startup' | 'periodic' | 'manual';
export type EnhancedInfoFetchSnapshot = ProfileFetchProgress & {
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
    errorMessage: string | null;
    friendsTotal: number;
    trackedTotal: number;
    collectionStatus:
        | 'idle'
        | 'running'
        | 'paused'
        | 'completed'
        | 'cancelled'
        | 'error';
    relationshipStatus:
        | 'waiting'
        | 'running'
        | 'completed'
        | 'unavailable'
        | 'error';
    relationshipError: string | null;
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
    errorMessage: null,
    friendsTotal: 0,
    trackedTotal: 0,
    collectionStatus: 'idle',
    relationshipStatus: 'waiting',
    relationshipError: null
});
let snapshot = emptySnapshot();
let snapshotScope = '';
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
export function getEnhancedInfoFetchTargetCounts(accountId: string) {
    const roster = useFriendRosterStore.getState();
    const tracked = useTrackedNonfriendsStore.getState();
    const friends = new Set(
        roster.currentUserId === accountId
            ? Object.entries(roster.friendsById)
                  .map(([key, value]) => String(value.id || key).trim())
                  .filter(Boolean)
            : []
    );
    const nonfriends = new Set(
        tracked.currentUserId === accountId
            ? tracked.entries
                  .map((entry) => entry.userId.trim())
                  .filter((id) => id && !friends.has(id))
            : []
    );
    return { friendsTotal: friends.size, trackedTotal: nonfriends.size };
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
        publish({
            phase: 'cancelled',
            collectionStatus:
                snapshot.collectionStatus === 'running' ||
                snapshot.collectionStatus === 'paused'
                    ? 'cancelled'
                    : snapshot.collectionStatus,
            pauseReason: null,
            nextRunAt: null
        });
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
        ...getEnhancedInfoFetchTargetCounts(accountId),
        accountId,
        source,
        running: true,
        collectionStatus: 'running',
        phase: 'fetching'
    };
    snapshotScope = scope;
    publish({});
    const isCurrent = () =>
        !controller.signal.aborted && currentScope() === scope;
    const update = (patch: Partial<EnhancedInfoFetchSnapshot>) => {
        if (active === token && isCurrent()) publish(patch);
    };
    const errorMessage = (error: unknown) =>
        error instanceof Error ? error.message : String(error);
    const dependencies: ProfileFetchDependencies = {
        getFriends: () => useFriendRosterStore.getState().friendsById,
        isAccountCurrent: () =>
            isCurrent() &&
            useFriendRosterStore.getState().currentUserId === accountId &&
            useFriendRosterStore.getState().loadStatus === 'ready',
        loadTracked: async (id) => {
            await useTrackedNonfriendsStore.getState().load(id);
            update(getEnhancedInfoFetchTargetCounts(id));
        },
        getTracked: () => useTrackedNonfriendsStore.getState(),
        getUserProfile: fetchRawProfile,
        reconcile: commands.appProfileFeedReconcile,
        updateName: (id, userId, name) =>
            useTrackedNonfriendsStore.getState().updateName(id, userId, name),
        wait: waitForEnhancedFetch
    };
    token.promise = (async () => {
        try {
            const profiles = createProfileFetchExecutor(dependencies)({
                accountId,
                signal: controller.signal,
                translate: (key) => key,
                onProfileProgress: (progress) => {
                    update({
                        ...progress,
                        collectionStatus: progress.pauseReason
                            ? 'paused'
                            : 'running',
                        phase: progress.pauseReason ? 'paused' : 'fetching'
                    });
                }
            })
                .then((outcome) => {
                    const completed =
                        outcome.status === 'completed' ||
                        outcome.skipReason ===
                            'workflow.skip.profile_fetch_empty';
                    update({
                        collectionStatus: completed ? 'completed' : 'cancelled',
                        phase: 'relationships',
                        currentTarget: null,
                        pauseReason: null,
                        nextRunAt: null
                    });
                    return outcome;
                })
                .catch((error: unknown) => {
                    update({
                        collectionStatus: 'error',
                        phase: 'error',
                        errorMessage: errorMessage(error)
                    });
                    throw error;
                });
            const relationships = (async () => {
                if (!recommendations) {
                    update({ relationshipStatus: 'unavailable' });
                    return;
                }
                update({ relationshipStatus: 'running' });
                try {
                    await recommendations({
                        accountId,
                        signal: controller.signal
                    });
                } catch (error) {
                    update({
                        relationshipStatus: 'error',
                        relationshipError: errorMessage(error)
                    });
                    throw error;
                }
                update({ relationshipStatus: 'completed' });
            })();
            // Recommendations consume local co-instance and graph history,
            // not the Bio/status observations being fetched in this task.
            const [profileResult, relationshipResult] =
                await Promise.allSettled([profiles, relationships]);
            if (profileResult.status === 'rejected') throw profileResult.reason;
            if (relationshipResult.status === 'rejected')
                throw relationshipResult.reason;
            if (active === token)
                publish({
                    phase:
                        isCurrent() && snapshot.collectionStatus === 'completed'
                            ? 'completed'
                            : 'cancelled'
                });
        } catch (error) {
            if (active === token)
                publish({
                    phase: !isCurrent() ? 'cancelled' : 'error',
                    errorMessage: isCurrent() ? errorMessage(error) : null
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
            if (source === 'reconnect') return;
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
        if (snapshotScope !== currentScope()) {
            cancelEnhancedInfoFetch();
            snapshotScope = currentScope();
            snapshot = {
                ...emptySnapshot(),
                accountId: useRuntimeStore.getState().auth.currentUserId,
                phase: 'cancelled',
                collectionStatus: 'cancelled'
            };
            publish({});
        }
    });
    const updateCounts = () => {
        if (!active) {
            const accountId = useRuntimeStore.getState().auth.currentUserId;
            if (snapshot.phase === 'idle' || snapshot.accountId !== accountId) {
                snapshot = { ...emptySnapshot(), accountId };
                publish(
                    accountId ? getEnhancedInfoFetchTargetCounts(accountId) : {}
                );
            }
        }
    };
    updateCounts();
    const unsubscribeFriends = useFriendRosterStore.subscribe(updateCounts);
    const unsubscribeTracked =
        useTrackedNonfriendsStore.subscribe(updateCounts);
    return () => {
        disposed = true;
        unsubscribeBaseline();
        unsubscribeRuntime();
        unsubscribeFriends();
        unsubscribeTracked();
        cancelEnhancedInfoFetch();
    };
}
