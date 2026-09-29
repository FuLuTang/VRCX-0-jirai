import type {
    SyncWorkflowAction,
    SyncWorkflowActionContext,
    SyncWorkflowActionOutcome
} from './syncWorkflow';

export type WorkflowTranslate = (key: string) => string;

/**
 * The stable injection seam for task 05. Its default deliberately performs no
 * storage writes or network requests until the Rust/Feed implementation lands.
 */
export type StartupOnlineBackfillExecutor = (
    context: SyncWorkflowActionContext
) => Promise<SyncWorkflowActionOutcome | void>;

const defaultStartupOnlineBackfillExecutor: StartupOnlineBackfillExecutor =
    async (context) => ({
        status: 'skipped',
        skipReason: context.translate('workflow.skip.not_implemented')
    });

let startupOnlineBackfillExecutor: StartupOnlineBackfillExecutor =
    defaultStartupOnlineBackfillExecutor;

export type ProfileFetchExecutor = (
    context: SyncWorkflowActionContext
) => Promise<SyncWorkflowActionOutcome | void>;
const defaultProfileFetchExecutor: ProfileFetchExecutor = async (context) => ({
    status: 'skipped',
    skipReason: context.translate('workflow.skip.not_implemented')
});
let profileFetchExecutor: ProfileFetchExecutor = defaultProfileFetchExecutor;
export function registerProfileFetchExecutor(
    executor: ProfileFetchExecutor
): () => void {
    profileFetchExecutor = executor;
    return () => {
        profileFetchExecutor = defaultProfileFetchExecutor;
    };
}

export type TrackedNonfriendsRefreshExecutor = (
    context: SyncWorkflowActionContext
) => Promise<SyncWorkflowActionOutcome | void>;

const defaultTrackedNonfriendsRefreshExecutor: TrackedNonfriendsRefreshExecutor =
    async (context) => ({
        status: 'skipped',
        skipReason: context.translate('workflow.skip.not_implemented')
    });

let trackedNonfriendsRefreshExecutor: TrackedNonfriendsRefreshExecutor =
    defaultTrackedNonfriendsRefreshExecutor;

export function registerStartupOnlineBackfillExecutor(
    executor: StartupOnlineBackfillExecutor
): () => void {
    startupOnlineBackfillExecutor = executor;
    return () => {
        startupOnlineBackfillExecutor = defaultStartupOnlineBackfillExecutor;
    };
}

export function registerTrackedNonfriendsRefreshExecutor(
    executor: TrackedNonfriendsRefreshExecutor
): () => void {
    trackedNonfriendsRefreshExecutor = executor;
    return () => {
        trackedNonfriendsRefreshExecutor =
            defaultTrackedNonfriendsRefreshExecutor;
    };
}

type CreateSyncWorkflowActionsOptions = {
    translate: WorkflowTranslate;
    startupOnlineBackfill?: StartupOnlineBackfillExecutor;
    trackedNonfriendsRefresh?: TrackedNonfriendsRefreshExecutor;
    profileFetch?: ProfileFetchExecutor;
};

function skippedAction(
    id: string,
    label: string,
    skipReason: string
): SyncWorkflowAction {
    return {
        id,
        label,
        status: 'pending',
        run: async () => ({ status: 'skipped', skipReason }),
        cancel: () => {}
    };
}

/**
 * Defines the only supported account sync actions. Each invocation returns new
 * runtime action objects; callers must not reuse a prior run's action list.
 */
export function createSyncWorkflowActions({
    translate,
    startupOnlineBackfill = startupOnlineBackfillExecutor,
    trackedNonfriendsRefresh = trackedNonfriendsRefreshExecutor,
    profileFetch = profileFetchExecutor
}: CreateSyncWorkflowActionsOptions): SyncWorkflowAction[] {
    return [
        {
            id: 'startup-online-backfill',
            label: translate('workflow.actions.startup_online_backfill'),
            status: 'pending',
            run: startupOnlineBackfill,
            cancel: () => {}
        },
        {
            id: 'tracked-non-friends-sync',
            label: translate('workflow.actions.tracked_non_friends_sync'),
            status: 'pending',
            run: trackedNonfriendsRefresh,
            cancel: () => {}
        },
        skippedAction(
            'manual-relations-sync',
            translate('workflow.actions.manual_relations_sync'),
            translate('workflow.skip.manual_relations_dependency')
        ),
        {
            id: 'automatic-profile-fetch',
            label: translate('workflow.actions.automatic_profile_fetch'),
            status: 'pending',
            run: profileFetch,
            cancel: () => {}
        },
        skippedAction(
            'relationship-recommendations',
            translate('workflow.actions.relationship_recommendations'),
            translate('workflow.skip.relationship_recommendations_dependency')
        )
    ];
}
