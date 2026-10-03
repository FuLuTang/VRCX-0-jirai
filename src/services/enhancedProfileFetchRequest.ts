import { commands } from '@/platform/tauri/bindings';
import { unwrapVrchatResponse } from '@/repositories/vrchatRequest';
import { isRecord } from '@/shared/utils/record';
import { useRuntimeStore } from '@/state/runtimeStore';

export type RawProfileFetchInput = {
    userId?: string;
    force?: boolean;
    dialog?: boolean;
    isFriend?: boolean | null;
    signal?: AbortSignal;
};
export type RawEnhancedProfile = {
    id?: string;
    displayName?: string;
    bio?: string;
    status?: string;
    statusDescription?: string;
    $jiraiBioUpdated?: boolean;
    $jiraiStatusUpdated?: boolean;
    [key: string]: unknown;
};
type Profile = RawEnhancedProfile;
const inflight = new Map<
    string,
    { promise: Promise<Profile>; signal?: AbortSignal }
>();

function waitBetweenEndpoints(signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted();
    return new Promise((resolve, reject) => {
        const onAbort = () => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
            reject(new DOMException('Profile fetch cancelled.', 'AbortError'));
        };
        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, 350);
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}

/** No completed-result cache: every trigger forces a fresh request. Preserve
 * upstream field presence; normalized defaults must never become observations. */
export const fetchRawProfile = (
    input: RawProfileFetchInput
): Promise<Profile> => {
    input.signal?.throwIfAborted();
    const session = useRuntimeStore.getState().authenticatedSession.session;
    const scope = () => {
        const state = useRuntimeStore.getState();
        return JSON.stringify([
            state.auth.currentUserId,
            state.authenticatedSession.session?.authScopeGeneration,
            state.authenticatedSession.session?.endpoint
        ]);
    };
    const expectedScope = scope();
    const ensureScope = () => {
        input.signal?.throwIfAborted();
        if (scope() !== expectedScope)
            throw new DOMException(
                'Profile account scope changed.',
                'AbortError'
            );
    };
    const key = JSON.stringify([
        useRuntimeStore.getState().auth.currentUserId,
        session?.authScopeGeneration,
        session?.endpoint,
        input.userId
    ]);
    const existing = inflight.get(key);
    if (existing && !existing.signal?.aborted) return existing.promise;
    const promise = (async () => {
        const response = await commands.appVrchatUserGet({
            userId: input.userId || '',
            force: true,
            dialog: input.dialog ?? false,
            isFriend: input.isFriend ?? null
        });
        const json = unwrapVrchatResponse(
            response,
            `users/${input.userId}`
        ).json;
        if (!isRecord(json)) throw new Error('Invalid user profile response.');
        ensureScope();
        await waitBetweenEndpoints(input.signal);
        ensureScope();
        // /profile is the canonical public Bio source. Call the native command
        // directly to force a request instead of the appearance-query cache.
        const publicResponse = await commands
            .appVrchatUserProfileGet({
                userId: input.userId || '',
                asSelf: false
            })
            .catch((error: unknown) => {
                if (isRecord(error) && json.$jiraiStatusUpdated === true)
                    error.$jiraiStatusUpdated = true;
                throw error;
            });
        ensureScope();
        let publicProfile: Record<string, unknown> = {};
        if (publicResponse.status !== 403 && publicResponse.status !== 404) {
            let value: unknown;
            try {
                value = unwrapVrchatResponse(
                    publicResponse,
                    `profile/${input.userId}`
                ).json;
            } catch (error) {
                if (isRecord(error) && json.$jiraiStatusUpdated === true)
                    error.$jiraiStatusUpdated = true;
                throw error;
            }
            if (!isRecord(value))
                throw new Error('Invalid public profile response.');
            publicProfile = value;
        }
        const text = (
            record: Record<string, unknown>,
            field: string
        ): string | undefined =>
            typeof record[field] === 'string' ? record[field] : undefined;
        return {
            id: text(json, 'id'),
            displayName: text(json, 'displayName'),
            ...(typeof publicProfile.bio === 'string'
                ? { bio: publicProfile.bio }
                : {}),
            ...(typeof json.status === 'string' ? { status: json.status } : {}),
            ...(typeof json.statusDescription === 'string'
                ? { statusDescription: json.statusDescription }
                : {}),
            $jiraiBioUpdated: publicProfile.$jiraiBioUpdated === true,
            $jiraiStatusUpdated: json.$jiraiStatusUpdated === true
        };
    })();
    inflight.set(key, { promise, signal: input.signal });
    void promise
        .finally(() => {
            if (inflight.get(key)?.promise === promise) inflight.delete(key);
        })
        .catch(() => {});
    return promise;
};

export function profileRetryAfterMs(error: unknown): number {
    const record = isRecord(error) ? error : {};
    const value = record.retryAfter;
    if (typeof value === 'number' && value >= 0) return value * 1000;
    if (typeof value === 'string' && value.trim()) {
        const seconds = Number(value);
        if (Number.isFinite(seconds))
            return seconds >= 0 ? seconds * 1000 : 5 * 60_000;
        const date = Date.parse(value);
        if (Number.isFinite(date)) return Math.max(0, date - Date.now());
    }
    return 5 * 60_000;
}
