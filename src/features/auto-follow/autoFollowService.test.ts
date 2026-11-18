import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    commands: {
        appAutoFollowStart: vi.fn(),
        appAutoFollowStop: vi.fn(),
        appAutoFollowStatus: vi.fn(),
        appQuitGame: vi.fn()
    },
    attachRunningVrchat: vi.fn(),
    launchVrchat: vi.fn(),
    toastAdd: vi.fn(),
    calls: [] as string[]
}));

vi.mock('@/platform/tauri/bindings', () => ({ commands: mocks.commands }));
vi.mock('@/services/launchService', () => ({
    attachRunningVrchat: mocks.attachRunningVrchat,
    launchVrchat: mocks.launchVrchat
}));
vi.mock('@/services/toastService', () => ({
    toast: { add: mocks.toastAdd, close: vi.fn() }
}));
vi.mock('@/services/i18nService', () => ({
    default: {
        t: (key: string, options?: { name?: string }) =>
            options?.name ? `${key}:${options.name}` : key
    }
}));

import {
    handleAutoFollowTriggered,
    resetAutoFollowServiceForTests,
    startAutoFollow,
    stopAutoFollow
} from './autoFollowService';
import { useAutoFollowStore } from './autoFollowStore';

const LOCATION_A = 'wrld_a:1~region(jp)';
const LOCATION_B = 'wrld_b:2~region(jp)';

function trigger(action: 'attach' | 'relaunchDesktop', location = LOCATION_A) {
    return handleAutoFollowTriggered({
        userId: 'usr_target',
        displayName: 'Target',
        location,
        action
    });
}

describe('autoFollowService (#7 executor, mock only — never launches VRChat)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        mocks.calls.length = 0;
        resetAutoFollowServiceForTests();
        useAutoFollowStore.setState({
            open: false,
            status: {
                active: false,
                targetUserId: null,
                targetDisplayName: null
            }
        });
        mocks.attachRunningVrchat.mockImplementation(
            async (location: string) => {
                mocks.calls.push(`attach:${location}`);
            }
        );
        mocks.commands.appQuitGame.mockImplementation(async () => {
            mocks.calls.push('quit');
            return 1;
        });
        mocks.launchVrchat.mockImplementation(
            async (location: string, shortName: string, desktop: boolean) => {
                mocks.calls.push(`launch:${location}:${shortName}:${desktop}`);
            }
        );
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('attach action opens the instance in the running game exactly once (A7-5)', async () => {
        await trigger('attach');
        expect(mocks.calls).toEqual([`attach:${LOCATION_A}`]);
        expect(mocks.commands.appQuitGame).not.toHaveBeenCalled();
        expect(mocks.launchVrchat).not.toHaveBeenCalled();
        expect(mocks.toastAdd).toHaveBeenCalledWith({
            type: 'info',
            title: 'jirai.auto_follow.switching:Target'
        });
    });

    it('relaunchDesktop quits then immediately launches with --no-vr (A7-6, A7-14)', async () => {
        await trigger('relaunchDesktop');
        expect(mocks.calls).toEqual(['quit', `launch:${LOCATION_A}::true`]);
    });

    it('relaunchDesktop still launches when no game process was quit (A7-14)', async () => {
        mocks.commands.appQuitGame.mockImplementation(async () => {
            mocks.calls.push('quit');
            return 0;
        });
        await trigger('relaunchDesktop');
        expect(mocks.calls).toEqual(['quit', `launch:${LOCATION_A}::true`]);
    });

    it('two consecutive instance changes produce two actions (A7-10, no cooldown)', async () => {
        await trigger('relaunchDesktop', LOCATION_A);
        await trigger('relaunchDesktop', LOCATION_B);
        expect(mocks.calls).toEqual([
            'quit',
            `launch:${LOCATION_A}::true`,
            'quit',
            `launch:${LOCATION_B}::true`
        ]);

        mocks.calls.length = 0;
        await trigger('attach', LOCATION_A);
        await vi.advanceTimersByTimeAsync(1000);
        await trigger('attach', LOCATION_B);
        expect(mocks.calls).toEqual([
            `attach:${LOCATION_A}`,
            `attach:${LOCATION_B}`
        ]);
    });

    it('drops attach calls inside the 1 s re-entry window like jirai tryOpenInstanceInVrc', async () => {
        await trigger('attach', LOCATION_A);
        await trigger('attach', LOCATION_B);
        expect(mocks.calls).toEqual([`attach:${LOCATION_A}`]);
    });

    it('surfaces executor failures as an error toast without throwing (A7-15 path)', async () => {
        mocks.attachRunningVrchat.mockRejectedValueOnce(
            new Error('open failed')
        );
        await expect(trigger('attach')).resolves.toBeUndefined();
        expect(mocks.toastAdd).toHaveBeenCalledWith({
            type: 'error',
            title: 'open failed'
        });
    });

    it('start and stop show toasts and mirror the Rust status (A7-8)', async () => {
        mocks.commands.appAutoFollowStart.mockResolvedValue({
            active: true,
            targetUserId: 'usr_target',
            targetDisplayName: 'Target'
        });
        await startAutoFollow('usr_target', 'Target');
        expect(useAutoFollowStore.getState().status.active).toBe(true);
        expect(mocks.toastAdd).toHaveBeenLastCalledWith({
            type: 'success',
            title: 'jirai.auto_follow.started:Target'
        });
        expect(mocks.calls).toEqual([]);

        mocks.commands.appAutoFollowStop.mockResolvedValue({
            active: false,
            targetUserId: null,
            targetDisplayName: null
        });
        await stopAutoFollow();
        expect(useAutoFollowStore.getState().status.active).toBe(false);
        expect(mocks.toastAdd).toHaveBeenLastCalledWith({
            type: 'success',
            title: 'jirai.auto_follow.stopped'
        });
    });

    it('stop while idle does not toast (jirai stopFollow only acts while active)', async () => {
        mocks.commands.appAutoFollowStop.mockResolvedValue({
            active: false,
            targetUserId: null,
            targetDisplayName: null
        });
        await stopAutoFollow();
        expect(mocks.toastAdd).not.toHaveBeenCalled();
    });
});
