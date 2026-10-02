import { commands } from '@/platform/tauri/bindings';
import { createProfileFetchExecutor } from '@/services/enhancedProfileFetchExecutor';
import { fetchRawProfile } from '@/services/enhancedProfileFetchRequest';
import { useFriendRosterStore } from '@/state/friendRosterStore';
import { useRuntimeStore } from '@/state/runtimeStore';
import { useTrackedNonfriendsStore } from '@/state/trackedNonfriendsStore';

import { registerProfileFetchExecutor } from './syncWorkflowActions';

export {
    createProfileFetchExecutor,
    type ProfileFetchDependencies
} from '@/services/enhancedProfileFetchExecutor';

function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
        const onAbort = () => {
            clearTimeout(timer);
            signal.removeEventListener('abort', onAbort);
            reject(new DOMException('Profile fetch cancelled.', 'AbortError'));
        };
        const timer = setTimeout(() => {
            signal.removeEventListener('abort', onAbort);
            resolve();
        }, milliseconds);
        signal.addEventListener('abort', onAbort, { once: true });
    });
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
    getUserProfile: fetchRawProfile,
    updateName: (accountId, userId, displayName) =>
        useTrackedNonfriendsStore
            .getState()
            .updateName(accountId, userId, displayName),
    reconcile: commands.appProfileFeedReconcile,
    wait
});
registerProfileFetchExecutor(profileFetchExecutor);
