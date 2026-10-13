import { presenceOf } from '@/domain/friends/presence';
import type { FriendRosterState } from '@/domain/friends/types';
import startupOnlineBackfillRepository, {
    type StartupOnlineBackfillInsert,
    type StartupOnlineBackfillInsertResult
} from '@/repositories/startupOnlineBackfillRepository';
import { useFriendRosterStore } from '@/state/friendRosterStore';
import { useRuntimeStore } from '@/state/runtimeStore';

import type {
    SyncWorkflowActionContext,
    SyncWorkflowActionOutcome
} from './syncWorkflow';
import {
    registerStartupOnlineBackfillExecutor,
    type StartupOnlineBackfillExecutor
} from './syncWorkflowActions';

export type StartupOnlineBackfillResult = {
    onlineFriendsProcessed: number;
    inserted: number;
    alreadyOnline: number;
    skippedOffline: number;
    skippedUnavailableState: number;
    skippedDuplicate: number;
    failed: number;
};

type StartupOnlineBackfillDependencies = {
    getRoster: () => FriendRosterState;
    isAccountCurrent: (accountId: string) => boolean;
    insertObservedOnline: (
        input: StartupOnlineBackfillInsert
    ) => Promise<StartupOnlineBackfillInsertResult>;
};

function normalized(value: unknown): string {
    return typeof value === 'string'
        ? value.trim()
        : String(value ?? '').trim();
}

function throwIfAborted(signal: AbortSignal): void {
    if (signal.aborted) {
        throw new DOMException(
            'Startup online backfill cancelled.',
            'AbortError'
        );
    }
}

function unavailableRosterOutcome(
    context: SyncWorkflowActionContext
): SyncWorkflowActionOutcome {
    return {
        status: 'skipped',
        skipReason: context.translate(
            'workflow.skip.startup_online_backfill_unavailable'
        )
    };
}

/**
 * Creates the task-05 executor. It reads only the friend roster projection:
 * entries whose state is unavailable are accounted for as skipped, never
 * persisted as a guessed Online or Offline edge.
 */
export function createStartupOnlineBackfillExecutor(
    dependencies: StartupOnlineBackfillDependencies
): StartupOnlineBackfillExecutor {
    return async (
        context: SyncWorkflowActionContext
    ): Promise<SyncWorkflowActionOutcome> => {
        const ownerUserId = normalized(context.accountId);
        if (!ownerUserId) {
            return {
                status: 'skipped',
                skipReason: context.translate(
                    'workflow.skip.startup_online_backfill_no_account'
                )
            };
        }
        throwIfAborted(context.signal);

        const roster = dependencies.getRoster();
        if (
            roster.loadStatus !== 'ready' ||
            normalized(roster.currentUserId) !== ownerUserId
        ) {
            return unavailableRosterOutcome(context);
        }

        const result: StartupOnlineBackfillResult = {
            onlineFriendsProcessed: 0,
            inserted: 0,
            alreadyOnline: 0,
            skippedOffline: 0,
            skippedUnavailableState: 0,
            skippedDuplicate: 0,
            failed: 0
        };
        const processedTargetUserIds = new Set<string>();

        for (const [friendKey, friend] of Object.entries(roster.friendsById)) {
            throwIfAborted(context.signal);
            if (!dependencies.isAccountCurrent(ownerUserId)) {
                return unavailableRosterOutcome(context);
            }
            const targetUserId = normalized(friend?.id || friendKey);
            const presence = presenceOf(friend);
            if (!targetUserId || !presence) {
                result.skippedUnavailableState += 1;
                continue;
            }
            if (presence.kind !== 'online') {
                result.skippedOffline += 1;
                continue;
            }
            if (processedTargetUserIds.has(targetUserId)) {
                result.skippedDuplicate += 1;
                continue;
            }
            processedTargetUserIds.add(targetUserId);

            result.onlineFriendsProcessed += 1;
            const insertInput = {
                expectedOwnerUserId: ownerUserId,
                targetUserId,
                displayName: normalized(friend.displayName) || targetUserId
            };
            try {
                const output =
                    await dependencies.insertObservedOnline(insertInput);
                throwIfAborted(context.signal);
                if (output.inserted) {
                    result.inserted += 1;
                } else {
                    result.alreadyOnline += 1;
                }
            } catch (error) {
                throwIfAborted(context.signal);
                if (!dependencies.isAccountCurrent(ownerUserId)) {
                    return unavailableRosterOutcome(context);
                }
                result.failed += 1;
                console.warn(
                    'Startup online backfill target failed:',
                    targetUserId,
                    error
                );
            }
        }

        return { status: 'completed', result };
    };
}

export const startupOnlineBackfillExecutor =
    createStartupOnlineBackfillExecutor({
        getRoster: () => useFriendRosterStore.getState(),
        isAccountCurrent: (accountId) =>
            useRuntimeStore.getState().auth.currentUserId === accountId &&
            useFriendRosterStore.getState().currentUserId === accountId,
        insertObservedOnline: (input) =>
            startupOnlineBackfillRepository.insertObservedOnline(input)
    });

// Task 04 owns the workflow action list. Registering here keeps task 05's
// implementation injectable while giving its real startup action this executor.
registerStartupOnlineBackfillExecutor(startupOnlineBackfillExecutor);
