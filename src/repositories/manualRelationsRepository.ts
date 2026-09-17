import { commands, type ManualRelationOutput } from '@/platform/tauri/bindings';

export type ManualRelation = ManualRelationOutput;

function normalizeId(value: string | null | undefined) {
    return value?.trim() ?? '';
}

function normalizePair(userIdA: string, userIdB: string) {
    const normalizedUserIdA = normalizeId(userIdA);
    const normalizedUserIdB = normalizeId(userIdB);
    if (!normalizedUserIdA || !normalizedUserIdB) {
        throw new Error('Manual relations require two user ids.');
    }
    if (normalizedUserIdA === normalizedUserIdB) {
        throw new Error('A manual relation cannot connect a user to itself.');
    }
    return normalizedUserIdA < normalizedUserIdB
        ? [normalizedUserIdA, normalizedUserIdB]
        : [normalizedUserIdB, normalizedUserIdA];
}

async function list(): Promise<ManualRelation[]> {
    return commands.appManualRelationsList();
}

async function listForUser(userId: string): Promise<ManualRelation[]> {
    const normalizedUserId = normalizeId(userId);
    if (!normalizedUserId) {
        return [];
    }
    return commands.appManualRelationsForUser(normalizedUserId);
}

async function add({
    userIdA,
    userIdB,
    relationType = 'friend'
}: {
    userIdA: string;
    userIdB: string;
    relationType?: string;
}) {
    const [normalizedUserIdA, normalizedUserIdB] = normalizePair(
        userIdA,
        userIdB
    );
    await commands.appManualRelationAdd(
        normalizedUserIdA,
        normalizedUserIdB,
        relationType.trim() || 'friend'
    );
}

async function remove({
    userIdA,
    userIdB
}: {
    userIdA: string;
    userIdB: string;
}) {
    const [normalizedUserIdA, normalizedUserIdB] = normalizePair(
        userIdA,
        userIdB
    );
    await commands.appManualRelationRemove(
        normalizedUserIdA,
        normalizedUserIdB
    );
}

const manualRelationsRepository = Object.freeze({
    add,
    list,
    listForUser,
    remove
});

export default manualRelationsRepository;
