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

async function list(): Promise<TrackedNonfriend[]> {
    return commands.appTrackedNonfriendsList();
}

async function add(input: TrackedNonFriendAddInput): Promise<boolean> {
    const userId = requireUserId(input.userId);
    return commands.appTrackedNonfriendsAdd({
        userId,
        displayName: input.displayName?.trim() || ''
    });
}

async function remove(userId: string): Promise<boolean> {
    return commands.appTrackedNonfriendsRemove(requireUserId(userId));
}

async function isTracked(userId: string): Promise<boolean> {
    return commands.appTrackedNonfriendsIsTracked(requireUserId(userId));
}

async function updateName(
    input: TrackedNonFriendUpdateNameInput
): Promise<boolean> {
    return commands.appTrackedNonfriendsUpdateName({
        userId: requireUserId(input.userId),
        displayName: input.displayName?.trim() || ''
    });
}

export default { list, add, remove, isTracked, updateName };
