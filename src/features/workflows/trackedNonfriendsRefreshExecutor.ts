import userProfileRepository from '@/repositories/userProfileRepository';
import { useTrackedNonfriendsStore } from '@/state/trackedNonfriendsStore';

import type {
    SyncWorkflowActionContext,
    SyncWorkflowActionOutcome
} from './syncWorkflow';
import {
    registerTrackedNonfriendsRefreshExecutor,
    type TrackedNonfriendsRefreshExecutor
} from './syncWorkflowActions';

const REFRESH_INTERVAL_MS = 250;

export type TrackedNonfriendsRefreshResult = {
    refreshed: number;
    skippedRemoved: number;
};

type Dependencies = {
    getEntries: () => ReturnType<
        typeof useTrackedNonfriendsStore.getState
    >['entries'];
    load: (accountId: string) => Promise<void>;
    isTracked: (userId: string) => boolean;
    updateName: (
        accountId: string,
        userId: string,
        displayName: string
    ) => Promise<boolean>;
    getUserProfile: typeof userProfileRepository.getUserProfile;
    wait: (milliseconds: number, signal: AbortSignal) => Promise<void>;
};

function abortIfNeeded(signal: AbortSignal): void {
    if (signal.aborted) {
        throw new DOMException(
            'Tracked non-friend refresh cancelled.',
            'AbortError'
        );
    }
}

function waitWithAbort(
    milliseconds: number,
    signal: AbortSignal
): Promise<void> {
    if (milliseconds <= 0) {
        return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
        const timeout = window.setTimeout(resolve, milliseconds);
        signal.addEventListener(
            'abort',
            () => {
                window.clearTimeout(timeout);
                reject(
                    new DOMException(
                        'Tracked non-friend refresh cancelled.',
                        'AbortError'
                    )
                );
            },
            { once: true }
        );
    });
}

export function createTrackedNonfriendsRefreshExecutor(
    dependencies: Dependencies
): TrackedNonfriendsRefreshExecutor {
    return async (
        context: SyncWorkflowActionContext
    ): Promise<SyncWorkflowActionOutcome> => {
        const accountId = context.accountId.trim();
        if (!accountId) {
            return {
                status: 'skipped',
                skipReason: context.translate(
                    'workflow.skip.tracked_nonfriends_no_account'
                )
            };
        }
        abortIfNeeded(context.signal);
        await dependencies.load(accountId);
        abortIfNeeded(context.signal);

        const entries = dependencies.getEntries();
        if (!entries.length) {
            return {
                status: 'skipped',
                skipReason: context.translate(
                    'workflow.skip.tracked_nonfriends_empty'
                )
            };
        }

        let refreshed = 0;
        let skippedRemoved = 0;
        let nextRequestAt = 0;
        for (const entry of entries) {
            abortIfNeeded(context.signal);
            if (!dependencies.isTracked(entry.userId)) {
                skippedRemoved += 1;
                continue;
            }
            const waitMs = Math.max(0, nextRequestAt - Date.now());
            await dependencies.wait(waitMs, context.signal);
            abortIfNeeded(context.signal);
            if (!dependencies.isTracked(entry.userId)) {
                skippedRemoved += 1;
                continue;
            }

            const profile = await dependencies.getUserProfile({
                userId: entry.userId,
                force: true,
                isFriend: false
            });
            abortIfNeeded(context.signal);
            refreshed += 1;
            nextRequestAt = Date.now() + REFRESH_INTERVAL_MS;
            if (!dependencies.isTracked(entry.userId)) {
                skippedRemoved += 1;
                continue;
            }
            const displayName = profile.displayName?.trim() || '';
            if (displayName && displayName !== entry.displayName) {
                await dependencies.updateName(
                    accountId,
                    entry.userId,
                    displayName
                );
                abortIfNeeded(context.signal);
            }
        }

        return { status: 'completed', result: { refreshed, skippedRemoved } };
    };
}

export const trackedNonfriendsRefreshExecutor =
    createTrackedNonfriendsRefreshExecutor({
        getEntries: () => useTrackedNonfriendsStore.getState().entries,
        load: (accountId) =>
            useTrackedNonfriendsStore.getState().load(accountId),
        isTracked: (userId) =>
            useTrackedNonfriendsStore.getState().isTracked(userId),
        updateName: (accountId, userId, displayName) =>
            useTrackedNonfriendsStore
                .getState()
                .updateName(accountId, userId, displayName),
        getUserProfile: userProfileRepository.getUserProfile,
        wait: waitWithAbort
    });

registerTrackedNonfriendsRefreshExecutor(trackedNonfriendsRefreshExecutor);
