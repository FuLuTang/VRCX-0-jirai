import { create } from 'zustand';

import type { RelationshipRecommendation } from '@/features/charts/relationshipRecommendations';
import manualRelationsRepository from '@/repositories/manualRelationsRepository';
import { recommendRelationships } from '@/repositories/relationshipRecommendationsRepository';

type State = {
    ownerUserId: string;
    items: RelationshipRecommendation[];
    ignored: Set<string>;
    loading: boolean;
    controller: AbortController | null;
    run(ownerUserId: string, candidates: readonly string[]): Promise<void>;
    cancel(): void;
    ignore(key: string): void;
    accept(item: RelationshipRecommendation): Promise<void>;
    reset(): void;
};
export const useRelationshipRecommendationsStore = create<State>(
    (set, get) => ({
        ownerUserId: '',
        items: [],
        ignored: new Set(),
        loading: false,
        controller: null,
        async run(ownerUserId, candidates) {
            const owner = ownerUserId.trim();
            if (!owner) return;
            get().controller?.abort();
            const controller = new AbortController();
            const ownerChanged = get().ownerUserId !== owner;
            set({
                ownerUserId: owner,
                loading: true,
                items: [],
                controller,
                ignored: ownerChanged ? new Set() : get().ignored
            });
            try {
                const items = await recommendRelationships({
                    ownerUserId: owner,
                    candidateUserIds: candidates,
                    signal: controller.signal,
                    limit: 100
                });
                if (get().ownerUserId === owner)
                    set({
                        items: items.filter(
                            (item) => !get().ignored.has(item.key)
                        ),
                        loading: false
                    });
            } catch (error) {
                if (
                    !(
                        error instanceof DOMException &&
                        error.name === 'AbortError'
                    )
                )
                    throw error;
            } finally {
                if (get().controller === controller)
                    set({ loading: false, controller: null });
            }
        },
        cancel() {
            get().controller?.abort();
        },
        ignore(key) {
            const ignored = new Set(get().ignored);
            ignored.add(key);
            set({
                ignored,
                items: get().items.filter((item) => item.key !== key)
            });
        },
        async accept(item) {
            await manualRelationsRepository.add({
                userIdA: item.userIdA,
                userIdB: item.userIdB,
                relationType: 'friend'
            });
            get().ignore(item.key);
        },
        reset() {
            get().controller?.abort();
            set({
                ownerUserId: '',
                items: [],
                ignored: new Set(),
                loading: false,
                controller: null
            });
        }
    })
);
