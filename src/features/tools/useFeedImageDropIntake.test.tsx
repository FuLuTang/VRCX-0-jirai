// @vitest-environment jsdom

import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    toastAdd: vi.fn(),
    validateImageFile: vi.fn()
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('@/services/toastService', () => ({
    toast: { add: mocks.toastAdd }
}));
vi.mock('./inventoryHelpers', () => ({
    validateImageFile: mocks.validateImageFile
}));

import {
    readFeedImageDrop,
    useFeedImageDropIntake
} from './useFeedImageDropIntake';

const authTarget = { userId: 'usr_self', endpoint: 'https://api' };

function setup({
    target,
    enabled = true,
    isVrcPlusSupporter = true,
    search = ''
}: {
    target: string;
    enabled?: boolean;
    isVrcPlusSupporter?: boolean;
    search?: string;
}) {
    const file = new File(['image'], 'drop.png', { type: 'image/png' });
    const openCropRequest = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) => (
        <MemoryRouter
            initialEntries={[
                {
                    pathname: '/tools/gallery',
                    search,
                    state: { feedImageDrop: { file, target } }
                }
            ]}
        >
            {children}
        </MemoryRouter>
    );
    const view = renderHook(
        (props: { enabled: boolean }) => {
            useFeedImageDropIntake({
                enabled: props.enabled,
                isVrcPlusSupporter,
                getAuthTarget: () => authTarget,
                isCurrentAuthTarget: () => true,
                openCropRequest
            });
            return useLocation();
        },
        { wrapper, initialProps: { enabled } }
    );
    return { file, openCropRequest, ...view };
}

describe('readFeedImageDrop', () => {
    it('accepts only a File with a known Gallery target', () => {
        const file = new File(['x'], 'x.png', { type: 'image/png' });
        expect(
            readFeedImageDrop({ feedImageDrop: { file, target: 'stickers' } })
        ).toEqual({ file, target: 'stickers' });
        expect(
            readFeedImageDrop({ feedImageDrop: { file, target: 'unknown' } })
        ).toBeNull();
        expect(
            readFeedImageDrop({ feedImageDrop: { file: 'x', target: 'icons' } })
        ).toBeNull();
        expect(readFeedImageDrop(null)).toBeNull();
    });
});

describe('useFeedImageDropIntake', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.validateImageFile.mockReturnValue(true);
    });

    it('opens the crop flow, selects the tab and clears the router state', async () => {
        const { file, openCropRequest, result } = setup({ target: 'icons' });

        await waitFor(() =>
            expect(openCropRequest).toHaveBeenCalledWith(
                file,
                'icons',
                authTarget
            )
        );
        expect(result.current.search).toBe('?tab=icons');
        expect(result.current.state).toBeNull();
    });

    it('keeps the current tab for emoji and sticker targets', async () => {
        const { openCropRequest, result } = setup({
            target: 'emojis',
            search: '?tab=prints'
        });

        await waitFor(() => expect(openCropRequest).toHaveBeenCalledTimes(1));
        expect(result.current.search).toBe('?tab=prints');
    });

    it('waits until uploads are possible', async () => {
        const { openCropRequest, rerender } = setup({
            target: 'gallery',
            enabled: false
        });
        expect(openCropRequest).not.toHaveBeenCalled();

        rerender({ enabled: true });
        await waitFor(() => expect(openCropRequest).toHaveBeenCalledTimes(1));
    });

    it('requires VRC+ for VRC+ only targets', async () => {
        const { openCropRequest, result } = setup({
            target: 'prints',
            isVrcPlusSupporter: false
        });

        await waitFor(() => expect(result.current.state).toBeNull());
        expect(mocks.toastAdd).toHaveBeenCalledWith({
            type: 'error',
            title: 'message.vrcplus.required'
        });
        expect(openCropRequest).not.toHaveBeenCalled();
    });

    it('drops files that fail image validation', async () => {
        mocks.validateImageFile.mockReturnValue(false);
        const { openCropRequest, result } = setup({ target: 'gallery' });

        await waitFor(() => expect(result.current.state).toBeNull());
        expect(openCropRequest).not.toHaveBeenCalled();
    });
});
