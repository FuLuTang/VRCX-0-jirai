import { create } from 'zustand';

import manualRelationsRepository, {
    type ManualRelation
} from '@/repositories/manualRelationsRepository';

interface ManualRelationsStoreState {
    ownerUserId: string;
    relations: ManualRelation[];
    isLoading: boolean;
    error: string;
    load(ownerUserId: string): Promise<void>;
    add(input: {
        ownerUserId: string;
        userIdA: string;
        userIdB: string;
        relationType?: string;
    }): Promise<void>;
    remove(input: {
        ownerUserId: string;
        userIdA: string;
        userIdB: string;
    }): Promise<void>;
    reset(): void;
}

const initialState = {
    ownerUserId: '',
    relations: [],
    isLoading: false,
    error: ''
};

export const useManualRelationsStore = create<ManualRelationsStoreState>(
    (set, get) => ({
        ...initialState,
        async load(ownerUserId) {
            const normalizedOwnerUserId = ownerUserId.trim();
            if (!normalizedOwnerUserId) {
                set({ ...initialState });
                return;
            }

            set({
                ownerUserId: normalizedOwnerUserId,
                relations: [],
                isLoading: true,
                error: ''
            });
            try {
                const relations = await manualRelationsRepository.list();
                if (get().ownerUserId !== normalizedOwnerUserId) {
                    return;
                }
                set({ relations, isLoading: false });
            } catch (error) {
                if (get().ownerUserId !== normalizedOwnerUserId) {
                    return;
                }
                set({
                    relations: [],
                    isLoading: false,
                    error: error instanceof Error ? error.message : ''
                });
            }
        },
        async add({ ownerUserId, ...relation }) {
            const normalizedOwnerUserId = ownerUserId.trim();
            await manualRelationsRepository.add(relation);
            await get().load(normalizedOwnerUserId);
        },
        async remove({ ownerUserId, ...relation }) {
            const normalizedOwnerUserId = ownerUserId.trim();
            await manualRelationsRepository.remove(relation);
            await get().load(normalizedOwnerUserId);
        },
        reset() {
            set({ ...initialState });
        }
    })
);
