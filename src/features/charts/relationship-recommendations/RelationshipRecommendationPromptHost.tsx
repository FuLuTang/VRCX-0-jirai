import { useUserDialogOpeningStore } from '@/state/userDialogOpeningStore';

import { useUserRelationshipRecommendationPrompt } from './useUserRelationshipRecommendationPrompt';

/**
 * #3b relationship prompt (jirai 392365f0 showUserDialog): when a player
 * profile finishes loading, ask about one recommendation that involves the
 * player. Mounted once in GlobalHosts; the open user dialog publishes itself
 * through useUserDialogOpeningStore.
 */
export function RelationshipRecommendationPromptHost() {
    const opening = useUserDialogOpeningStore((state) => state.opening);
    useUserRelationshipRecommendationPrompt({
        userId: opening.userId,
        openNonce: opening.openNonce,
        ready: opening.ready
    });
    return null;
}
