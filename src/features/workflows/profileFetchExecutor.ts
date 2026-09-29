import { commands } from '@/platform/tauri/bindings';
import userProfileRepository from '@/repositories/userProfileRepository';
import {
    isVrchatMissingCredentialsError,
    isVrchatRequestError
} from '@/repositories/vrchatRequest';
import { isRecord } from '@/shared/utils/record';
import { useFriendRosterStore } from '@/state/friendRosterStore';
import { useRuntimeStore } from '@/state/runtimeStore';
import { useTrackedNonfriendsStore } from '@/state/trackedNonfriendsStore';

import type { SyncWorkflowActionOutcome } from './syncWorkflow';
import {
    registerProfileFetchExecutor,
    type ProfileFetchExecutor
} from './syncWorkflowActions';

// Match the existing profile-Bio scan cadence for a full-account sweep.
const REQUEST_INTERVAL_MS = 3_000;

function requestStatus(error: unknown): number | null {
    if (isVrchatRequestError(error)) return error.status;
    if (
        isRecord(error) &&
        error.code === 'vrchat_api' &&
        typeof error.statusCode === 'number'
    ) {
        return error.statusCode;
    }
    return null;
}

function shouldStopSweep(error: unknown): boolean {
    const status = requestStatus(error);
    return (
        isVrchatMissingCredentialsError(error) ||
        status === 429 ||
        (status !== null && status >= 500) ||
        (error instanceof Error && error.name === 'AbortError')
    );
}

function abortIfNeeded(signal: AbortSignal) {
    if (signal.aborted)
        throw new DOMException('Profile fetch cancelled.', 'AbortError');
}
function wait(milliseconds: number, signal: AbortSignal) {
    abortIfNeeded(signal);
    return new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => {
            signal.removeEventListener('abort', onAbort);
            resolve();
        }, milliseconds);
        const onAbort = () => {
            window.clearTimeout(timer);
            reject(new DOMException('Profile fetch cancelled.', 'AbortError'));
        };
        signal.addEventListener('abort', onAbort, { once: true });
    });
}

export type ProfileFetchDependencies = {
    getFriends: () => Record<string, { id?: string; displayName?: string }>;
    isAccountCurrent: (accountId: string) => boolean;
    loadTracked: (accountId: string) => Promise<void>;
    getTracked: () => {
        currentUserId: string | null;
        entries: Array<{ userId: string; displayName: string }>;
    };
    getUserProfile: typeof userProfileRepository.getUserProfile;
    reconcile: typeof commands.appProfileFeedReconcile;
    wait: (milliseconds: number, signal: AbortSignal) => Promise<void>;
};

export function createProfileFetchExecutor(
    dependencies: ProfileFetchDependencies
): ProfileFetchExecutor {
    return async (context): Promise<SyncWorkflowActionOutcome> => {
        const accountId = context.accountId.trim();
        if (!accountId)
            return {
                status: 'skipped',
                skipReason: context.translate(
                    'workflow.skip.profile_fetch_no_account'
                )
            };
        abortIfNeeded(context.signal);
        await dependencies.loadTracked(accountId);
        abortIfNeeded(context.signal);
        if (!dependencies.isAccountCurrent(accountId))
            return {
                status: 'skipped',
                skipReason: context.translate(
                    'workflow.skip.profile_fetch_no_account'
                )
            };
        const targets = new Map<
            string,
            { displayName: string; isFriend: boolean }
        >();
        for (const [key, friend] of Object.entries(dependencies.getFriends())) {
            const userId = String(friend.id || key).trim();
            if (userId)
                targets.set(userId, {
                    displayName: String(friend.displayName || userId),
                    isFriend: true
                });
        }
        const tracked = dependencies.getTracked();
        if (tracked.currentUserId === accountId)
            for (const entry of tracked.entries) {
                const userId = entry.userId.trim();
                if (userId && !targets.has(userId))
                    targets.set(userId, {
                        displayName: entry.displayName,
                        isFriend: false
                    });
            }
        if (!targets.size)
            return {
                status: 'skipped',
                skipReason: context.translate(
                    'workflow.skip.profile_fetch_empty'
                )
            };
        let bioUpdated = 0,
            statusUpdated = 0,
            failed = 0,
            incomplete = 0;
        const targetEntries = [...targets];
        for (let index = 0; index < targetEntries.length; index += 1) {
            const [userId, target] = targetEntries[index];
            abortIfNeeded(context.signal);
            if (!dependencies.isAccountCurrent(accountId))
                return {
                    status: 'skipped',
                    skipReason: context.translate(
                        'workflow.skip.profile_fetch_no_account'
                    )
                };
            let profile;
            for (let attempt = 0; attempt < 2; attempt += 1) {
                abortIfNeeded(context.signal);
                if (!dependencies.isAccountCurrent(accountId))
                    return {
                        status: 'skipped',
                        skipReason: context.translate(
                            'workflow.skip.profile_fetch_no_account'
                        )
                    };
                try {
                    profile = await dependencies.getUserProfile({
                        userId,
                        force: true,
                        isFriend: target.isFriend
                    });
                    break;
                } catch (error) {
                    abortIfNeeded(context.signal);
                    if (shouldStopSweep(error)) throw error;
                    const status = requestStatus(error);
                    if (status !== null && status >= 400 && status < 500) {
                        failed += 1;
                        break;
                    }
                    if (attempt) throw error;
                    await dependencies.wait(
                        REQUEST_INTERVAL_MS,
                        context.signal
                    );
                }
            }
            abortIfNeeded(context.signal);
            if (profile) {
                if (!dependencies.isAccountCurrent(accountId))
                    return {
                        status: 'skipped',
                        skipReason: context.translate(
                            'workflow.skip.profile_fetch_no_account'
                        )
                    };
                const hasBio = typeof profile.bio === 'string';
                const hasStatus =
                    typeof profile.status === 'string' &&
                    typeof profile.statusDescription === 'string';
                if (!hasStatus) {
                    incomplete += 1;
                }
                if (hasBio || hasStatus) {
                    const result = await dependencies.reconcile({
                        expectedOwnerUserId: accountId,
                        userId,
                        displayName:
                            profile.displayName?.trim() ||
                            target.displayName ||
                            userId,
                        ...(hasBio ? { bio: profile.bio } : {}),
                        ...(hasStatus
                            ? {
                                  status: profile.status,
                                  statusDescription: profile.statusDescription
                              }
                            : {})
                    });
                    if (result.bioUpdated) bioUpdated += 1;
                    if (result.statusUpdated) statusUpdated += 1;
                }
            }
            if (index + 1 < targetEntries.length) {
                await dependencies.wait(REQUEST_INTERVAL_MS, context.signal);
            }
        }
        return {
            status: 'completed',
            result: {
                targets: targets.size,
                bioUpdated,
                statusUpdated,
                failed,
                incomplete
            }
        };
    };
}

export const profileFetchExecutor = createProfileFetchExecutor({
    getFriends: () => useFriendRosterStore.getState().friendsById,
    isAccountCurrent: (accountId) =>
        useRuntimeStore.getState().auth.currentUserId === accountId &&
        useFriendRosterStore.getState().currentUserId === accountId &&
        useFriendRosterStore.getState().loadStatus === 'ready',
    loadTracked: (accountId) =>
        useTrackedNonfriendsStore.getState().load(accountId),
    getTracked: () => useTrackedNonfriendsStore.getState(),
    getUserProfile: userProfileRepository.getUserProfile,
    reconcile: commands.appProfileFeedReconcile,
    wait
});
registerProfileFetchExecutor(profileFetchExecutor);
