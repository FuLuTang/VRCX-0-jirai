import { commands } from '@/platform/tauri/bindings';
import {
    isVrchatMissingCredentialsError,
    isVrchatRequestError
} from '@/repositories/vrchatRequest';
import { isRecord } from '@/shared/utils/record';

import {
    fetchRawProfile,
    profileRetryAfterMs,
    type RawEnhancedProfile
} from './enhancedProfileFetchRequest';

// Short sequential pacing; HTTP 429 owns the server-directed queue pause.
const REQUEST_INTERVAL_MS = 350;
const RETRY_INTERVAL_MS = 3_000;

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
    return (
        isVrchatMissingCredentialsError(error) ||
        (error instanceof Error && error.name === 'AbortError')
    );
}

function abortIfNeeded(signal: AbortSignal) {
    if (signal.aborted)
        throw new DOMException('Profile fetch cancelled.', 'AbortError');
}

export type ProfileFetchProgress = {
    currentTarget: { userId: string; displayName: string } | null;
    total: number;
    processed: number;
    succeeded: number;
    unchanged: number;
    failed: number;
    incomplete: number;
    bioUpdated: number;
    statusUpdated: number;
    pauseReason: string | null;
    nextRunAt: string | null;
};
export type EnhancedProfileFetchOutcome =
    | { status: 'completed'; result?: unknown }
    | { status: 'skipped'; skipReason: string };
export type EnhancedProfileFetchExecutor = (context: {
    accountId: string;
    signal: AbortSignal;
    translate: (key: string) => string;
    profiles?: Map<string, RawEnhancedProfile>;
    onProfileProgress?: (progress: ProfileFetchProgress) => void;
}) => Promise<EnhancedProfileFetchOutcome>;

export type ProfileFetchDependencies = {
    getFriends: () => Record<string, { id?: string; displayName?: string }>;
    isAccountCurrent: (accountId: string) => boolean;
    loadTracked: (accountId: string) => Promise<void>;
    getTracked: () => {
        currentUserId: string | null;
        entries: Array<{ userId: string; displayName: string }>;
    };
    getUserProfile: typeof fetchRawProfile;
    reconcile: typeof commands.appProfileFeedReconcile;
    wait: (milliseconds: number, signal: AbortSignal) => Promise<void>;
    updateName?: (
        accountId: string,
        userId: string,
        displayName: string
    ) => Promise<boolean>;
};

export function createProfileFetchExecutor(
    dependencies: ProfileFetchDependencies
): EnhancedProfileFetchExecutor {
    return async (context): Promise<EnhancedProfileFetchOutcome> => {
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
        let processed = 0,
            succeeded = 0,
            unchanged = 0;
        const publish = (
            currentTarget: { userId: string; displayName: string } | null,
            pauseReason: string | null = null,
            nextRunAt: string | null = null
        ) =>
            context.onProfileProgress?.({
                currentTarget,
                total: targets.size,
                processed,
                succeeded,
                unchanged,
                failed,
                incomplete,
                bioUpdated,
                statusUpdated,
                pauseReason,
                nextRunAt
            });
        publish(null);
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
            publish({ userId, displayName: target.displayName });
            let profile = context.profiles?.get(userId);
            let statusReceiptCounted = false;
            for (let attempt = 0; attempt < 2; attempt += 1) {
                if (profile) break;
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
                        isFriend: target.isFriend,
                        signal: context.signal
                    });
                    break;
                } catch (error) {
                    abortIfNeeded(context.signal);
                    if (
                        isRecord(error) &&
                        error.$jiraiStatusUpdated === true &&
                        !statusReceiptCounted
                    ) {
                        statusUpdated += 1;
                        statusReceiptCounted = true;
                    }
                    if (requestStatus(error) === 429) {
                        const delay = profileRetryAfterMs(error);
                        publish(
                            { userId, displayName: target.displayName },
                            'HTTP 429',
                            new Date(Date.now() + delay).toISOString()
                        );
                        await dependencies.wait(delay, context.signal);
                        publish({ userId, displayName: target.displayName });
                        if (attempt) failed += 1;
                        continue;
                    }
                    if (shouldStopSweep(error)) throw error;
                    const status = requestStatus(error);
                    if (status !== null && status >= 400 && status < 500) {
                        failed += 1;
                        break;
                    }
                    if (attempt) {
                        failed += 1;
                        break;
                    }
                    await dependencies.wait(RETRY_INTERVAL_MS, context.signal);
                }
            }
            abortIfNeeded(context.signal);
            if (profile) {
                // A failed public-Bio request can follow an already committed
                // status update. Keep its receipt across retries for this user.
                if (statusReceiptCounted) profile.$jiraiStatusUpdated = true;
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
                if (!hasBio || !hasStatus) {
                    incomplete += 1;
                }
                if (profile.$jiraiBioUpdated) bioUpdated += 1;
                if (profile.$jiraiStatusUpdated && !statusReceiptCounted)
                    statusUpdated += 1;
                let stored = true;
                try {
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
                                      statusDescription:
                                          profile.statusDescription
                                  }
                                : {})
                        });
                        if (result.bioUpdated && !profile.$jiraiBioUpdated)
                            bioUpdated += 1;
                        if (
                            result.statusUpdated &&
                            !profile.$jiraiStatusUpdated
                        )
                            statusUpdated += 1;
                        if (
                            !result.bioUpdated &&
                            !result.statusUpdated &&
                            !profile.$jiraiBioUpdated &&
                            !profile.$jiraiStatusUpdated
                        )
                            unchanged += 1;
                    }
                    abortIfNeeded(context.signal);
                    if (!dependencies.isAccountCurrent(accountId))
                        return {
                            status: 'skipped',
                            skipReason: context.translate(
                                'workflow.skip.profile_fetch_no_account'
                            )
                        };
                    if (
                        !target.isFriend &&
                        dependencies.updateName &&
                        profile.displayName?.trim()
                    ) {
                        await dependencies.updateName(
                            accountId,
                            userId,
                            profile.displayName.trim()
                        );
                    }
                } catch (error) {
                    abortIfNeeded(context.signal);
                    if (shouldStopSweep(error)) throw error;
                    if (!dependencies.isAccountCurrent(accountId))
                        return {
                            status: 'skipped',
                            skipReason: context.translate(
                                'workflow.skip.profile_fetch_no_account'
                            )
                        };
                    stored = false;
                    failed += 1;
                }
                if (stored) succeeded += 1;
            }
            processed += 1;
            publish({ userId, displayName: target.displayName });
            if (index + 1 < targetEntries.length) {
                await dependencies.wait(REQUEST_INTERVAL_MS, context.signal);
            }
        }
        publish(null);
        return {
            status: 'completed',
            result: {
                targets: targets.size,
                bioUpdated,
                statusUpdated,
                failed,
                incomplete,
                processed,
                succeeded,
                unchanged
            }
        };
    };
}
