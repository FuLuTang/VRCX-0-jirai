import {
    commands,
    type StartupOnlineBackfillInput,
    type StartupOnlineBackfillOutput
} from '@/platform/tauri/bindings';

export type StartupOnlineBackfillInsert = StartupOnlineBackfillInput;
export type StartupOnlineBackfillInsertResult = StartupOnlineBackfillOutput;

function normalize(value: string): string {
    return value.trim();
}

async function insertObservedOnline(
    input: StartupOnlineBackfillInsert
): Promise<StartupOnlineBackfillInsertResult> {
    const targetUserId = normalize(input.targetUserId);
    if (!targetUserId) {
        throw new Error('Startup online backfill requires a target user.');
    }

    return commands.appStartupOnlineBackfillInsert({
        targetUserId,
        displayName: String(input.displayName || '').trim() || targetUserId
    });
}

const startupOnlineBackfillRepository = {
    insertObservedOnline
};

export default startupOnlineBackfillRepository;
