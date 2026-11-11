// @vitest-environment jsdom

import { PhysicalPosition } from '@tauri-apps/api/dpi';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FileDragDropEvent } from '@/platform/tauri/fileDrop';

const mocks = vi.hoisted(() => ({
    handler: null as ((event: FileDragDropEvent) => void) | null,
    unlisten: vi.fn(),
    onFileDragDrop: vi.fn(),
    readDroppedUploadImage: vi.fn()
}));

vi.mock('@/platform/tauri/fileDrop', () => ({
    onFileDragDrop: mocks.onFileDragDrop
}));

vi.mock('@/features/tools/inventoryHelpers', () => ({
    readDroppedUploadImage: mocks.readDroppedUploadImage
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

import {
    FEED_IMAGE_DROP_TARGETS,
    FeedImageDropOverlay
} from './FeedImageDropOverlay';

const outside = new PhysicalPosition(500, 500);
const inside = new PhysicalPosition(50, 50);

beforeEach(() => {
    vi.clearAllMocks();
    mocks.handler = null;
    mocks.onFileDragDrop.mockImplementation(
        async (handler: (event: FileDragDropEvent) => void) => {
            mocks.handler = handler;
            return mocks.unlisten;
        }
    );
    Object.defineProperty(window, 'devicePixelRatio', {
        configurable: true,
        value: 1
    });
});

afterEach(() => {
    cleanup();
});

function emit(event: FileDragDropEvent) {
    act(() => {
        mocks.handler?.(event);
    });
}

async function renderOverlay(onSelect = vi.fn()) {
    const view = render(
        <FeedImageDropOverlay onSelect={onSelect}>
            <div data-testid="feed-drop-child" />
        </FeedImageDropOverlay>
    );
    await waitFor(() => expect(mocks.handler).not.toBeNull());
    return { onSelect, ...view };
}

function placeTarget(target: string) {
    const zone = document.querySelector(
        `[data-drop-target="${target}"]`
    ) as HTMLDivElement;
    vi.spyOn(zone, 'getBoundingClientRect').mockReturnValue({
        bottom: 100,
        height: 100,
        left: 0,
        right: 100,
        toJSON: () => ({}),
        top: 0,
        width: 100,
        x: 0,
        y: 0
    });
}

describe('FeedImageDropOverlay', () => {
    it('shows the overlay while files are dragged over the window', async () => {
        await renderOverlay();

        emit({ type: 'enter', paths: ['C:/a.png'], position: outside });
        expect(screen.getByTestId('feed-image-drop-overlay')).toBeTruthy();

        emit({ type: 'leave' });
        expect(screen.queryByTestId('feed-image-drop-overlay')).toBeNull();
    });

    it('renders all five legacy Gallery upload targets', async () => {
        await renderOverlay();

        emit({ type: 'enter', paths: ['C:/a.png'], position: outside });

        expect(
            Array.from(document.querySelectorAll('[data-drop-target]')).map(
                (element) => element.getAttribute('data-drop-target')
            )
        ).toEqual(FEED_IMAGE_DROP_TARGETS);
    });

    it('forwards one dropped image and the target under the cursor', async () => {
        const file = new File(['image'], 'sticker.png', { type: 'image/png' });
        mocks.readDroppedUploadImage.mockResolvedValue(file);
        const { onSelect } = await renderOverlay();

        emit({ type: 'enter', paths: ['C:/sticker.png'], position: outside });
        placeTarget('stickers');
        emit({ type: 'over', position: inside });
        emit({ type: 'drop', paths: ['C:/sticker.png'], position: inside });

        await waitFor(() =>
            expect(onSelect).toHaveBeenCalledWith(file, 'stickers')
        );
        expect(mocks.readDroppedUploadImage).toHaveBeenCalledWith(
            ['C:/sticker.png'],
            expect.any(Function)
        );
        expect(screen.queryByTestId('feed-image-drop-overlay')).toBeNull();
    });

    it('converts physical positions using the device pixel ratio', async () => {
        Object.defineProperty(window, 'devicePixelRatio', {
            configurable: true,
            value: 2
        });
        const file = new File(['image'], 'icon.png', { type: 'image/png' });
        mocks.readDroppedUploadImage.mockResolvedValue(file);
        const { onSelect } = await renderOverlay();

        emit({ type: 'enter', paths: ['C:/icon.png'], position: outside });
        placeTarget('icons');
        emit({
            type: 'drop',
            paths: ['C:/icon.png'],
            position: new PhysicalPosition(180, 180)
        });

        await waitFor(() =>
            expect(onSelect).toHaveBeenCalledWith(file, 'icons')
        );
    });

    it.each([
        {
            paths: ['C:/one.png', 'C:/two.png'],
            position: inside,
            label: 'multi-file'
        },
        { paths: ['C:/one.png'], position: outside, label: 'off-target' }
    ])('ignores $label drops', async ({ paths, position }) => {
        const { onSelect } = await renderOverlay();

        emit({ type: 'enter', paths, position: outside });
        placeTarget('gallery');
        emit({ type: 'drop', paths, position });

        await Promise.resolve();
        expect(mocks.readDroppedUploadImage).not.toHaveBeenCalled();
        expect(onSelect).not.toHaveBeenCalled();
    });

    it('does not forward files that fail image validation', async () => {
        mocks.readDroppedUploadImage.mockResolvedValue(null);
        const { onSelect } = await renderOverlay();

        emit({ type: 'enter', paths: ['C:/notes.txt'], position: outside });
        placeTarget('gallery');
        emit({ type: 'drop', paths: ['C:/notes.txt'], position: inside });

        await waitFor(() =>
            expect(mocks.readDroppedUploadImage).toHaveBeenCalled()
        );
        expect(onSelect).not.toHaveBeenCalled();
    });

    it('stops listening when unmounted', async () => {
        const { unmount } = await renderOverlay();
        unmount();
        expect(mocks.unlisten).toHaveBeenCalled();
    });
});
