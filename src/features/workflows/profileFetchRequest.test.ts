import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/platform/tauri/bindings', () => ({
    commands: { appVrchatUserGet: vi.fn(), appVrchatUserProfileGet: vi.fn() }
}));
import { commands } from '@/platform/tauri/bindings';

import { fetchRawProfile, profileRetryAfterMs } from './profileFetchRequest';

let fakeNow = Date.parse('2100-01-01T00:00:00Z');

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});
beforeEach(() => {
    vi.useFakeTimers();
    // The request limiter intentionally persists between calls, so keep fake
    // time monotonic and beyond any pause reserved by the previous test.
    fakeNow += 60 * 60_000;
    vi.setSystemTime(fakeNow);
    vi.mocked(commands.appVrchatUserGet).mockReset();
    vi.mocked(commands.appVrchatUserProfileGet)
        .mockReset()
        .mockResolvedValue({ status: 200, data: '{}' });
});
async function fetchWithTimers(input: Parameters<typeof fetchRawProfile>[0]) {
    const promise = fetchRawProfile(input);
    await vi.runAllTimersAsync();
    return promise;
}
describe('raw enhanced profile requests', () => {
    it('retains a committed status receipt when public Bio is rate limited', async () => {
        vi.mocked(commands.appVrchatUserGet).mockResolvedValue({
            status: 200,
            data: '{"id":"usr_partial_saved","$jiraiStatusUpdated":true}'
        });
        vi.mocked(commands.appVrchatUserProfileGet).mockResolvedValue({
            status: 429,
            data: '{}',
            retryAfter: '12'
        });
        const pending = expect(
            fetchRawProfile({ userId: 'usr_partial_saved' })
        ).rejects.toMatchObject({
            status: 429,
            retryAfter: '12',
            $jiraiStatusUpdated: true
        });
        await vi.runAllTimersAsync();
        await pending;
    });
    it('preserves absent Bio AND absent statusDescription, without normalization defaults', async () => {
        vi.mocked(commands.appVrchatUserGet).mockResolvedValue({
            status: 200,
            data: '{"id":"usr_partial","status":"active"}'
        });
        const profile = await fetchWithTimers({ userId: 'usr_partial' });
        expect(profile).not.toHaveProperty('bio');
        expect(profile).not.toHaveProperty('statusDescription');
    });
    it('merges only in-flight requests, never completed results', async () => {
        let finish!: (response: { status: number; data: string }) => void;
        const request = vi
            .mocked(commands.appVrchatUserGet)
            .mockImplementationOnce(
                () =>
                    new Promise((resolve) => {
                        finish = resolve;
                    })
            );
        const first = fetchRawProfile({ userId: 'usr_merge' });
        expect(fetchRawProfile({ userId: 'usr_merge' })).toBe(first);
        await vi.advanceTimersByTimeAsync(1);
        finish({ status: 200, data: '{"id":"usr_merge","bio":""}' });
        vi.mocked(commands.appVrchatUserProfileGet).mockResolvedValueOnce({
            status: 200,
            data: '{"bio":""}'
        });
        await vi.runAllTimersAsync();
        await first;
        request.mockResolvedValue({
            status: 200,
            data: '{"id":"usr_merge","bio":"new"}'
        });
        vi.mocked(commands.appVrchatUserProfileGet).mockResolvedValueOnce({
            status: 200,
            data: '{"bio":"new"}'
        });
        expect((await fetchWithTimers({ userId: 'usr_merge' })).bio).toBe(
            'new'
        );
        expect(request).toHaveBeenCalledTimes(2);
        expect(commands.appVrchatUserProfileGet).toHaveBeenCalledTimes(2);
    });
    it('uses authoritative public Bio and passes the native committed-change receipt', async () => {
        vi.mocked(commands.appVrchatUserGet).mockResolvedValue({
            status: 200,
            data: '{"id":"usr_public","bio":"stale","status":"active","statusDescription":"visible","$jiraiStatusUpdated":true}'
        });
        vi.mocked(commands.appVrchatUserProfileGet).mockResolvedValue({
            status: 200,
            data: '{"bio":"canonical","$jiraiBioUpdated":true}'
        });
        expect(await fetchWithTimers({ userId: 'usr_public' })).toMatchObject({
            bio: 'canonical',
            $jiraiBioUpdated: true,
            $jiraiStatusUpdated: true,
            statusDescription: 'visible'
        });
        expect(commands.appVrchatUserProfileGet).toHaveBeenCalledWith({
            userId: 'usr_public',
            asSelf: false
        });
    });
    it('never falls back to stale /users Bio if public Profile omits it or denies access', async () => {
        vi.mocked(commands.appVrchatUserGet).mockResolvedValue({
            status: 200,
            data: '{"id":"usr_private","bio":"old","status":"active"}'
        });
        vi.mocked(commands.appVrchatUserProfileGet).mockResolvedValue({
            status: 403,
            data: '{}'
        });
        expect(
            await fetchWithTimers({ userId: 'usr_private' })
        ).not.toHaveProperty('bio');
    });
    it('does not start a canonical request after cancellation while /users is pending', async () => {
        const controller = new AbortController();
        vi.mocked(commands.appVrchatUserGet).mockImplementationOnce(
            async () => {
                controller.abort();
                return { status: 200, data: '{"id":"usr_cancel"}' };
            }
        );
        const pending = fetchRawProfile({
            userId: 'usr_cancel',
            signal: controller.signal
        });
        await vi.advanceTimersByTimeAsync(1);
        await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
        expect(commands.appVrchatUserProfileGet).not.toHaveBeenCalled();
    });
    it('starts requests 300ms apart without waiting for earlier responses', async () => {
        const startedAt: number[] = [];
        const pendingResponses: Array<
            (response: { status: number; data: string }) => void
        > = [];
        vi.mocked(commands.appVrchatUserGet).mockImplementation(
            () =>
                new Promise((resolve) => {
                    startedAt.push(Date.now());
                    pendingResponses.push(resolve);
                })
        );
        const first = fetchRawProfile({ userId: 'usr_a' });
        const second = fetchRawProfile({ userId: 'usr_b' });
        await vi.advanceTimersByTimeAsync(1);
        expect(commands.appVrchatUserGet).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(299);
        expect(commands.appVrchatUserGet).toHaveBeenCalledTimes(2);
        expect(startedAt[1] - startedAt[0]).toBe(300);

        pendingResponses[0]({ status: 200, data: '{"id":"usr_a"}' });
        pendingResponses[1]({ status: 200, data: '{"id":"usr_b"}' });
        await vi.runAllTimersAsync();
        await Promise.all([first, second]);
    });
    it('reads Retry-After seconds and HTTP dates, falls back to five minutes', () => {
        vi.spyOn(Date, 'now').mockReturnValue(
            Date.parse('2026-10-02T00:00:00Z')
        );
        expect(profileRetryAfterMs({ retryAfter: '12' })).toBe(12_000);
        expect(
            profileRetryAfterMs({ retryAfter: 'Fri, 02 Oct 2026 00:01:00 GMT' })
        ).toBe(60_000);
        for (const retryAfter of [undefined, '', 'broken', '-1'])
            expect(profileRetryAfterMs({ retryAfter })).toBe(300_000);
    });
});
