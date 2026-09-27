import {
    scoreRelationshipRecommendations,
    type RelationshipRecommendation
} from '@/features/charts/relationshipRecommendations';
import { commands } from '@/platform/tauri/bindings';

import manualRelationsRepository from './manualRelationsRepository';
import mutualGraphPersistenceRepository from './mutualGraphPersistenceRepository';

export async function recommendRelationships(input: {
    ownerUserId: string;
    candidateUserIds: readonly string[];
    signal?: AbortSignal;
    limit?: number;
}): Promise<RelationshipRecommendation[]> {
    const ownerUserId = input.ownerUserId.trim();
    const candidates = [
        ...new Set(
            input.candidateUserIds.map((value) => value.trim()).filter(Boolean)
        )
    ].slice(0, 20);
    if (!ownerUserId || !candidates.length) return [];
    const [manualPairs, mutual] = await Promise.all([
        manualRelationsRepository.list(),
        mutualGraphPersistenceRepository.getSnapshot(ownerUserId)
    ]);
    if (input.signal?.aborted)
        throw new DOMException('Recommendation cancelled.', 'AbortError');
    const evidence = await commands.appRelationshipEvidenceQuery({
        candidateUserIds: candidates,
        perCandidateLimit: 200,
        totalLimit: 1000
    });
    if (input.signal?.aborted)
        throw new DOMException('Recommendation cancelled.', 'AbortError');
    const mutualPairs = [];
    for (const [userId, ids] of mutual.snapshot)
        for (const other of ids)
            mutualPairs.push({ ownerUserId, userIdA: userId, userIdB: other });
    return scoreRelationshipRecommendations({
        ownerUserId,
        selfUserId: ownerUserId,
        evidence,
        manualPairs: manualPairs.map((pair) => ({ ...pair, ownerUserId })),
        mutualPairs,
        limit: input.limit
    });
}
