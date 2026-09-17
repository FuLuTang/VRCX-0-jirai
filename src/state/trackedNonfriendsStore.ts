import { create } from 'zustand';

import type { TrackedNonfriend } from '@/repositories/trackedNonfriendsRepository';
import trackedNonfriendsRepository from '@/repositories/trackedNonfriendsRepository';

export type TrackedNonfriendsLoadStatus =
    | 'idle'
    | 'loading'
    | 'ready'
    | 'error';

type TrackedNonfriendsState = {
    currentUserId: string | null;
    entries: TrackedNonfriend[];
    loadStatus: TrackedNonfriendsLoadStatus;
    error: string | null;
    load(accountId: string): Promise<void>;
    add(
        accountId: string,
        userId: string,
        displayName?: string
    ): Promise<boolean>;
    remove(accountId: string, userId: string): Promise<boolean>;
    updateName(
        accountId: string,
        userId: string,
        displayName: string
    ): Promise<boolean>;
    isTracked(userId: string): boolean;
    reset(): void;
};

function normalize(value: string | null | undefined): string {
    return String(value || '').trim();
}

function sameAccount(
    state: TrackedNonfriendsState,
    accountId: string
): boolean {
    return state.currentUserId === normalize(accountId);
}

const initialState = {
    currentUserId: null,
    entries: [],
    loadStatus: 'idle' as const,
    error: null
};

export const useTrackedNonfriendsStore = create<TrackedNonfriendsState>(
    (set, get) => ({
        ...initialState,
        async load(accountId) {
            const normalizedAccountId = normalize(accountId);
            if (!normalizedAccountId) {
                set(initialState);
                return;
            }
            set({
                currentUserId: normalizedAccountId,
                entries: [],
                loadStatus: 'loading',
                error: null
            });
            try {
                const entries = await trackedNonfriendsRepository.list();
                if (get().currentUserId !== normalizedAccountId) {
                    return;
                }
                set({ entries, loadStatus: 'ready', error: null });
            } catch (error) {
                if (get().currentUserId !== normalizedAccountId) {
                    return;
                }
                set({
                    entries: [],
                    loadStatus: 'error',
                    error:
                        error instanceof Error ? error.message : String(error)
                });
            }
        },
        async add(accountId, userId, displayName = '') {
            if (!sameAccount(get(), accountId)) {
                return false;
            }
            const added = await trackedNonfriendsRepository.add({
                userId,
                displayName
            });
            if (added && sameAccount(get(), accountId)) {
                await get().load(accountId);
            }
            return added;
        },
        async remove(accountId, userId) {
            if (!sameAccount(get(), accountId)) {
                return false;
            }
            const removed = await trackedNonfriendsRepository.remove(userId);
            if (removed && sameAccount(get(), accountId)) {
                set((state) => ({
                    ...state,
                    entries: state.entries.filter(
                        (entry) => entry.userId !== userId.trim()
                    )
                }));
            }
            return removed;
        },
        async updateName(accountId, userId, displayName) {
            if (!sameAccount(get(), accountId)) {
                return false;
            }
            const updated = await trackedNonfriendsRepository.updateName({
                userId,
                displayName
            });
            if (updated && sameAccount(get(), accountId)) {
                set((state) => ({
                    ...state,
                    entries: state.entries.map((entry) =>
                        entry.userId === userId.trim()
                            ? { ...entry, displayName: displayName.trim() }
                            : entry
                    )
                }));
            }
            return updated;
        },
        isTracked(userId) {
            const normalizedUserId = normalize(userId);
            return get().entries.some(
                (entry) => entry.userId === normalizedUserId
            );
        },
        reset() {
            set(initialState);
        }
    })
);
