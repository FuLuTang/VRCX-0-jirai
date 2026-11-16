import {
    commands,
    type TrackedNonFriendAddInput,
    type TrackedNonFriendOutput,
    type TrackedNonFriendUpdateNameInput
} from '@/platform/tauri/bindings';

export type TrackedNonfriend = TrackedNonFriendOutput;

function normalizeUserId(userId: string): string {
    return userId.trim();
}

function requireUserId(userId: string): string {
    const normalized = normalizeUserId(userId);
    if (!normalized) {
        throw new Error('Tracked non-friends requires a user id.');
    }
    return normalized;
}

function requireOwnerUserId(ownerUserId: string): string {
    const normalized = normalizeUserId(ownerUserId);
    if (!normalized) {
        throw new Error('Tracked non-friends requires an account.');
    }
    return normalized;
}

async function list(expectedOwnerUserId: string): Promise<TrackedNonfriend[]> {
    return commands.appTrackedNonfriendsList(
        requireOwnerUserId(expectedOwnerUserId)
    );
}

async function add(
    expectedOwnerUserId: string,
    input: TrackedNonFriendAddInput
): Promise<boolean> {
    const userId = requireUserId(input.userId);
    return commands.appTrackedNonfriendsAdd(
        requireOwnerUserId(expectedOwnerUserId),
        {
            userId,
            displayName: input.displayName?.trim() || ''
        }
    );
}

async function remove(
    expectedOwnerUserId: string,
    userId: string
): Promise<boolean> {
    return commands.appTrackedNonfriendsRemove(
        requireOwnerUserId(expectedOwnerUserId),
        requireUserId(userId)
    );
}

async function isTracked(
    expectedOwnerUserId: string,
    userId: string
): Promise<boolean> {
    return commands.appTrackedNonfriendsIsTracked(
        requireOwnerUserId(expectedOwnerUserId),
        requireUserId(userId)
    );
}

async function updateName(
    expectedOwnerUserId: string,
    input: TrackedNonFriendUpdateNameInput
): Promise<boolean> {
    return commands.appTrackedNonfriendsUpdateName(
        requireOwnerUserId(expectedOwnerUserId),
        {
            userId: requireUserId(input.userId),
            displayName: input.displayName?.trim() || ''
        }
    );
}

export default { list, add, remove, isTracked, updateName };
