import {
    commands,
    type AutoFollowStatus,
    type AutoFollowTriggered
} from '@/platform/tauri/bindings';
import i18n from '@/services/i18nService';
import { attachRunningVrchat, launchVrchat } from '@/services/launchService';
import { toast } from '@/services/toastService';

import { useAutoFollowStore } from './autoFollowStore';

const OPEN_INSTANCE_DEBOUNCE_MS = 1000;
let openingInstance = false;

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export async function refreshAutoFollowStatus(): Promise<AutoFollowStatus> {
    const status = await commands.appAutoFollowStatus();
    useAutoFollowStore.getState().setStatus(status);
    return status;
}

/** jirai autoFollow.startFollow: single target, replaces the previous one. */
export async function startAutoFollow(
    userId: string,
    displayName: string
): Promise<void> {
    try {
        const status = await commands.appAutoFollowStart(userId);
        useAutoFollowStore.getState().setStatus(status);
        toast.add({
            type: 'success',
            title: i18n.t('jirai.auto_follow.started', {
                name: status.targetDisplayName || displayName
            })
        });
    } catch (error) {
        toast.add({ type: 'error', title: errorMessage(error) });
    }
}

/** jirai autoFollow.stopFollow: only acts while following. */
export async function stopAutoFollow(): Promise<void> {
    const wasActive = useAutoFollowStore.getState().status.active;
    try {
        const status = await commands.appAutoFollowStop();
        useAutoFollowStore.getState().setStatus(status);
        if (wasActive) {
            toast.add({
                type: 'success',
                title: i18n.t('jirai.auto_follow.stopped')
            });
        }
    } catch (error) {
        toast.add({ type: 'error', title: errorMessage(error) });
    }
}

/** jirai launch.tryOpenInstanceInVrc: 1 s re-entry guard, errors swallowed. */
async function openInstanceInRunningGame(location: string): Promise<void> {
    if (openingInstance) {
        return;
    }
    openingInstance = true;
    try {
        await attachRunningVrchat(location);
    } finally {
        setTimeout(() => {
            openingInstance = false;
        }, OPEN_INSTANCE_DEBOUNCE_MS);
    }
}

/**
 * Executes one auto-follow action decided by Rust (D4 = A).
 * - attach: open the instance in the running game; failure falls back to a
 *   self invite inside attachRunningVrchat (A7-5, A7-15).
 * - relaunchDesktop: quit VRChat (only when exactly one process exists) and
 *   immediately launch it in desktop mode into the instance; also launches
 *   when the game was not running (A7-6, A7-14).
 */
export async function handleAutoFollowTriggered(
    payload: AutoFollowTriggered
): Promise<void> {
    toast.add({
        type: 'info',
        title: i18n.t('jirai.auto_follow.switching', {
            name: payload.displayName || payload.userId
        })
    });
    try {
        if (payload.action === 'attach') {
            await openInstanceInRunningGame(payload.location);
            return;
        }
        await commands.appQuitGame();
        await launchVrchat(payload.location, '', true);
    } catch (error) {
        toast.add({ type: 'error', title: errorMessage(error) });
    }
}

export function resetAutoFollowServiceForTests(): void {
    openingInstance = false;
}
