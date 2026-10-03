// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), generation: 1 }));
vi.mock('@/platform/tauri/bindings', () => ({
    commands: { appBackendRuntimeCombinedSnapshotGet: mocks.get }
}));
vi.mock('@/state/runtimeStore', () => ({
    useRuntimeStore: (selector: (state: unknown) => unknown) =>
        selector({
            authenticatedSession: {
                session: {
                    authScopeGeneration: mocks.generation,
                    endpoint: 'test'
                }
            }
        })
}));
import { useEnhancedFetchSchedule } from './useEnhancedFetchSchedule';

function snapshot(userId = 'usr_owner') {
    return {
        authenticatedSession: {
            session: {
                userId,
                authScopeGeneration: mocks.generation,
                endpoint: 'test'
            }
        },
        backgroundJobs: [
            {
                name: 'backgroundSocialBaselineRefresh',
                cadenceSeconds: 3600,
                nextRunAt: '2026-10-03T06:30:00Z',
                status: 'scheduled',
                failureCount: 0
            },
            { name: 'unrelated', nextRunAt: '2026-10-03T06:30:00Z' }
        ]
    };
}
beforeEach(() => {
    vi.useFakeTimers();
    mocks.generation = 1;
    mocks.get.mockReset().mockResolvedValue(snapshot());
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
});
describe('native enhanced fetch schedule polling', () => {
    it('copies the native deadline, polls every ten seconds only while open', async () => {
        const view = renderHook(
            ({ open }) => useEnhancedFetchSchedule(open, 'usr_owner'),
            { initialProps: { open: false } }
        );
        expect(mocks.get).not.toHaveBeenCalled();
        view.rerender({ open: true });
        await act(async () => {
            await Promise.resolve();
        });
        expect(view.result.current?.jobs).toHaveLength(1);
        expect(view.result.current?.jobs[0].nextRunAt).toBe(
            '2026-10-03T06:30:00Z'
        );
        await act(async () => {
            await vi.advanceTimersByTimeAsync(10_000);
        });
        expect(mocks.get).toHaveBeenCalledTimes(2);
        view.rerender({ open: false });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(20_000);
        });
        expect(mocks.get).toHaveBeenCalledTimes(2);
        expect(view.result.current).toBeNull();
    });
    it('hides stale deadlines after read failure or account mismatch', async () => {
        mocks.get.mockRejectedValueOnce(new Error('offline'));
        const view = renderHook(() =>
            useEnhancedFetchSchedule(true, 'usr_owner')
        );
        await act(async () => {
            await Promise.resolve();
        });
        expect(view.result.current).toMatchObject({ error: true, jobs: [] });
        mocks.get.mockResolvedValueOnce(snapshot('usr_other'));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(10_000);
        });
        expect(view.result.current?.jobs).toEqual([]);
    });
    it('discards a pending response after closing', async () => {
        let finish!: (value: unknown) => void;
        mocks.get.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    finish = resolve;
                })
        );
        const view = renderHook(
            ({ open }) => useEnhancedFetchSchedule(open, 'usr_owner'),
            { initialProps: { open: true } }
        );
        view.rerender({ open: false });
        await act(async () => {
            finish(snapshot());
            await Promise.resolve();
        });
        expect(view.result.current).toBeNull();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(20_000);
        });
        expect(mocks.get).toHaveBeenCalledTimes(1);
    });
});
