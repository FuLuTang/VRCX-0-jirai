import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import {
    confirmRelationshipRecommendation,
    ignoreRelationshipRecommendation,
    useRelationshipRecommendations
} from '@/features/charts/relationship-recommendations/relationshipRecommendationsService';
import { toast } from '@/services/toastService';
import { useRuntimeStore } from '@/state/runtimeStore';
import { Button } from '@/ui/shadcn/button';

type ActivePrompt = {
    id: string;
    opening: string;
    pairKey: string;
};

export function useUserRelationshipRecommendationPrompt({
    userId,
    openNonce,
    ready
}: {
    userId: string;
    openNonce: number;
    ready: boolean;
}) {
    const { t } = useTranslation();
    const accountId =
        useRuntimeStore((state) => state.auth.currentUserId) || '';
    const generation = useRuntimeStore(
        (state) => state.authenticatedSession.session?.authScopeGeneration
    );
    const recommendations = useRelationshipRecommendations(
        (state) => state.accounts[accountId]
    );
    const activePrompt = useRef<ActivePrompt | null>(null);
    const shownOpening = useRef('');

    useEffect(() => {
        const opening = `${accountId}:${generation}:${userId}:${openNonce}`;
        const closeActive = () => {
            if (activePrompt.current) {
                toast.close(activePrompt.current.id);
                activePrompt.current = null;
            }
        };

        if (activePrompt.current?.opening !== opening) {
            closeActive();
        }

        const eligible =
            ready &&
            userId &&
            accountId &&
            userId !== accountId &&
            generation != null &&
            recommendations?.generation === generation;
        const suggestion = eligible
            ? recommendations.suggestions.find(
                  (row) =>
                      !row.isAdded &&
                      !recommendations.ignored.has(row.key) &&
                      (row.userIdA === userId || row.userIdB === userId)
              )
            : undefined;

        // A changed/revoked candidate must not leave a stale interactive toast.
        if (
            activePrompt.current &&
            (!suggestion || suggestion.key !== activePrompt.current.pairKey)
        ) {
            closeActive();
        }
        // Only one question per dialog opening, as in the original version.
        if (!suggestion || shownOpening.current === opening) return;

        shownOpening.current = opening;
        const otherName =
            suggestion.userIdA === userId ? suggestion.nameB : suggestion.nameA;
        let submitting = false;
        let toastId = '';
        const respond = async (confirm: boolean) => {
            if (submitting) return;
            submitting = true;
            try {
                if (confirm) {
                    await confirmRelationshipRecommendation(
                        accountId,
                        suggestion
                    );
                } else {
                    await ignoreRelationshipRecommendation(
                        accountId,
                        suggestion.key
                    );
                }
                toast.close(toastId);
                if (activePrompt.current?.id === toastId) {
                    activePrompt.current = null;
                }
            } catch (error) {
                submitting = false;
                toast.add({
                    type: 'error',
                    title:
                        error instanceof Error ? error.message : String(error)
                });
            }
        };

        toastId = toast.add({
            type: 'info',
            position: 'bottom-right',
            title: t('jirai.relationship_recommendations.prompt_title'),
            description: (
                <span className="flex flex-col gap-2">
                    <span>
                        {t(
                            'jirai.relationship_recommendations.prompt_question',
                            {
                                name: otherName
                            }
                        )}
                    </span>
                    <span className="flex justify-end gap-2">
                        <Button
                            type="button"
                            size="xs"
                            onClick={() => void respond(true)}
                        >
                            {t('jirai.relationship_recommendations.prompt_yes')}
                        </Button>
                        <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            onClick={() => void respond(false)}
                        >
                            {t(
                                'jirai.relationship_recommendations.prompt_ignore'
                            )}
                        </Button>
                    </span>
                </span>
            ),
            timeout: 6000,
            data: { closeButton: true }
        });
        activePrompt.current = {
            id: toastId,
            opening,
            pairKey: suggestion.key
        };
    }, [accountId, generation, openNonce, ready, recommendations, t, userId]);

    useEffect(
        () => () => {
            if (activePrompt.current) {
                toast.close(activePrompt.current.id);
                activePrompt.current = null;
            }
            shownOpening.current = '';
        },
        []
    );
}
