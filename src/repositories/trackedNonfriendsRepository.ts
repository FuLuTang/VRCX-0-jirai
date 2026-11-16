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

// The owner scope is enforced natively: every command below resolves the
// current authenticated owner inside the runtime host, so the renderer must not
// pass one. `expectedOwnerUserId` stays in the signature only so callers keep a
// single place to assert they are acting on the account they think they are.
async function list(expectedOwnerUserId: string): Promise<TrackedNonfriend[]> {
    requireOwnerUserId(expectedOwnerUserId);
    return commands.appTrackedNonfriendsList();
}

async function add(
    expectedOwnerUserId: string,
    input: TrackedNonFriendAddInput
): Promise<boolean> {
    requireOwnerUserId(expectedOwnerUserId);
    const userId = requireUserId(input.userId);
    return commands.appTrackedNonfriendsAdd({
        userId,
        displayName: input.displayName?.trim() || ''
    });
}

async function remove(
    expectedOwnerUserId: string,
    userId: string
): Promise<boolean> {
    requireOwnerUserId(expectedOwnerUserId);
    return commands.appTrackedNonfriendsRemove(requireUserId(userId));
}

async function isTracked(
    expectedOwnerUserId: string,
    userId: string
): Promise<boolean> {
    requireOwnerUserId(expectedOwnerUserId);
    return commands.appTrackedNonfriendsIsTracked(requireUserId(userId));
}

async function updateName(
    expectedOwnerUserId: string,
    input: TrackedNonFriendUpdateNameInput
): Promise<boolean> {
    requireOwnerUserId(expectedOwnerUserId);
    return commands.appTrackedNonfriendsUpdateName({
        userId: requireUserId(input.userId),
        displayName: input.displayName?.trim() || ''
    });
}

export default { list, add, remove, isTracked, updateName };
