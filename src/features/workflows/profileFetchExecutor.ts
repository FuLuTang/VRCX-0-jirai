import { commands } from '@/platform/tauri/bindings';
import userProfileRepository from '@/repositories/userProfileRepository';
import { useFriendRosterStore } from '@/state/friendRosterStore';
import { useTrackedNonfriendsStore } from '@/state/trackedNonfriendsStore';

import type {
    SyncWorkflowActionContext,
    SyncWorkflowActionOutcome
} from './syncWorkflow';
import {
    registerProfileFetchExecutor,
    type ProfileFetchExecutor
} from './syncWorkflowActions';

const REQUEST_INTERVAL_MS = 250;

function abortIfNeeded(signal: AbortSignal) {
    if (signal.aborted)
        throw new DOMException('Profile fetch cancelled.', 'AbortError');
}
function wait(milliseconds: number, signal: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(resolve, milliseconds);
        signal.addEventListener(
            'abort',
            () => {
                window.clearTimeout(timer);
                reject(
                    new DOMException('Profile fetch cancelled.', 'AbortError')
                );
            },
            { once: true }
        );
    });
}

export type ProfileFetchDependencies = {
    getFriends: () => Record<string, { id?: string; displayName?: string }>;
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
            failed = 0;
        for (const [userId, target] of targets) {
            abortIfNeeded(context.signal);
            let profile;
            for (let attempt = 0; attempt < 2; attempt += 1) {
                try {
                    profile = await dependencies.getUserProfile({
                        userId,
                        force: true,
                        isFriend: target.isFriend
                    });
                    break;
                } catch (error) {
                    if (attempt || context.signal.aborted) {
                        failed += 1;
                        break;
                    }
                    await dependencies.wait(500, context.signal);
                }
            }
            abortIfNeeded(context.signal);
            if (profile) {
                const result = await dependencies.reconcile({
                    userId,
                    displayName:
                        profile.displayName?.trim() ||
                        target.displayName ||
                        userId,
                    bio: profile.bio || '',
                    status: profile.status || '',
                    statusDescription: profile.statusDescription || ''
                });
                if (result.bioUpdated) bioUpdated += 1;
                if (result.statusUpdated) statusUpdated += 1;
            }
            await dependencies.wait(REQUEST_INTERVAL_MS, context.signal);
        }
        return {
            status: 'completed',
            result: { targets: targets.size, bioUpdated, statusUpdated, failed }
        };
    };
}

export const profileFetchExecutor = createProfileFetchExecutor({
    getFriends: () => useFriendRosterStore.getState().friendsById,
    loadTracked: (accountId) =>
        useTrackedNonfriendsStore.getState().load(accountId),
    getTracked: () => useTrackedNonfriendsStore.getState(),
    getUserProfile: userProfileRepository.getUserProfile,
    reconcile: commands.appProfileFeedReconcile,
    wait
});
registerProfileFetchExecutor(profileFetchExecutor);
