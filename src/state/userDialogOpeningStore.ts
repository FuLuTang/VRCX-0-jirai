import { create } from 'zustand';

/**
 * The user dialog that is currently open, as published by UserDialogContent.
 * Feature hosts (for example the #3b relationship prompt) read it without the
 * shared dialog component importing feature modules.
 */
export type UserDialogOpening = {
    userId: string;
    openNonce: number;
    /** The requested profile has finished loading. */
    ready: boolean;
};

const closed: UserDialogOpening = { userId: '', openNonce: 0, ready: false };

type UserDialogOpeningStore = {
    opening: UserDialogOpening;
    publishUserDialogOpening(opening: UserDialogOpening): void;
    clearUserDialogOpening(userId: string, openNonce: number): void;
};

export const useUserDialogOpeningStore = create<UserDialogOpeningStore>(
    (set) => ({
        opening: closed,
        publishUserDialogOpening(opening) {
            set((state) =>
                state.opening.userId === opening.userId &&
                state.opening.openNonce === opening.openNonce &&
                state.opening.ready === opening.ready
                    ? state
                    : { opening }
            );
        },
        clearUserDialogOpening(userId, openNonce) {
            set((state) =>
                state.opening.userId === userId &&
                state.opening.openNonce === openNonce
                    ? { opening: closed }
                    : state
            );
        }
    })
);
