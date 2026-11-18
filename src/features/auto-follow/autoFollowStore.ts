import { create } from 'zustand';

import type { AutoFollowStatus } from '@/platform/tauri/bindings';

const idleStatus: AutoFollowStatus = {
    active: false,
    targetUserId: null,
    targetDisplayName: null
};

type AutoFollowStoreState = {
    open: boolean;
    status: AutoFollowStatus;
    setOpen(open: boolean): void;
    setStatus(status: AutoFollowStatus): void;
};

export const useAutoFollowStore = create<AutoFollowStoreState>((set) => ({
    open: false,
    status: idleStatus,
    setOpen(open) {
        set({ open });
    },
    setStatus(status) {
        set({ status });
    }
}));

/**
 * Opens the auto-follow dialog. Like jirai `openAutoFollowDialog`
 * (coordinators/autoFollowCoordinator.js), there is no visible entry point:
 * this function is the only way to open it (A7-17).
 */
export function openAutoFollowDialog(): void {
    useAutoFollowStore.getState().setOpen(true);
}

export function closeAutoFollowDialog(): void {
    useAutoFollowStore.getState().setOpen(false);
}
