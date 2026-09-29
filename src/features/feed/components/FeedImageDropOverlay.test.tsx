// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { toast } from '@/services/toastService';
import { MAX_IMAGE_UPLOAD_BYTES } from '@/shared/constants/imageUpload';

import {
    FEED_IMAGE_DROP_TARGETS,
    FeedImageDropOverlay
} from './FeedImageDropOverlay';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('@/services/toastService', () => ({
    toast: { add: vi.fn() }
}));

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

function dragData(files: File[] = []) {
    return {
        dropEffect: 'none',
        files,
        types: ['Files']
    };
}

function renderOverlay(onSelect = vi.fn()) {
    render(
        <FeedImageDropOverlay onSelect={onSelect}>
            <div data-testid="feed-drop-surface" />
        </FeedImageDropOverlay>
    );
    return { onSelect, surface: screen.getByTestId('feed-drop-surface') };
}

function hoverTarget(surface: HTMLElement, target: string) {
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
    fireEvent.dragOver(zone, {
        clientX: 50,
        clientY: 50,
        dataTransfer: dragData()
    });
}

describe('FeedImageDropOverlay', () => {
    it('keeps the overlay open until every nested drag leave is balanced', () => {
        const { surface } = renderOverlay();

        fireEvent.dragEnter(surface, { dataTransfer: dragData() });
        fireEvent.dragEnter(surface, { dataTransfer: dragData() });
        fireEvent.dragLeave(surface, { dataTransfer: dragData() });

        expect(screen.getByTestId('feed-image-drop-overlay')).toBeTruthy();

        fireEvent.dragLeave(surface, { dataTransfer: dragData() });

        expect(screen.queryByTestId('feed-image-drop-overlay')).toBeNull();
    });

    it('renders all five legacy Gallery upload targets', () => {
        const { surface } = renderOverlay();

        fireEvent.dragEnter(surface, { dataTransfer: dragData() });

        expect(
            Array.from(document.querySelectorAll('[data-drop-target]')).map(
                (element) => element.getAttribute('data-drop-target')
            )
        ).toEqual(FEED_IMAGE_DROP_TARGETS);
    });

    it('forwards one image File and its chosen target', () => {
        const { onSelect, surface } = renderOverlay();
        const file = new File(['image'], 'sticker.png', { type: 'image/png' });

        fireEvent.dragEnter(surface, { dataTransfer: dragData([file]) });
        hoverTarget(surface, 'stickers');
        fireEvent.drop(surface, {
            clientX: 50,
            clientY: 50,
            dataTransfer: dragData([file])
        });

        expect(onSelect).toHaveBeenCalledWith(file, 'stickers');
    });

    it.each([
        { files: [], label: 'empty', message: 'message.upload.error' },
        {
            files: [new File(['text'], 'notes.txt', { type: 'text/plain' })],
            label: 'non-image',
            message: 'message.file.not_image'
        },
        {
            files: [new File(['svg'], 'vector.svg', { type: 'image/svg+xml' })],
            label: 'unsupported image',
            message: 'message.file.not_image'
        },
        {
            files: [
                Object.defineProperty(
                    new File(['image'], 'large.png', { type: 'image/png' }),
                    'size',
                    { value: MAX_IMAGE_UPLOAD_BYTES }
                ) as File
            ],
            label: 'oversized image',
            message: 'message.file.too_large'
        },
        {
            files: [
                new File(['one'], 'one.png', { type: 'image/png' }),
                new File(['two'], 'two.png', { type: 'image/png' })
            ],
            label: 'multi-file',
            message: 'message.upload.error'
        }
    ])('rejects $label drops with feedback', ({ files, message }) => {
        const { onSelect, surface } = renderOverlay();

        fireEvent.dragEnter(surface, { dataTransfer: dragData(files) });
        hoverTarget(surface, 'gallery');
        fireEvent.drop(surface, {
            clientX: 50,
            clientY: 50,
            dataTransfer: dragData(files)
        });

        expect(onSelect).not.toHaveBeenCalled();
        expect(toast.add).toHaveBeenCalledWith({
            type: 'error',
            title: message
        });
    });

    it('does not route a file dropped outside the target zones', () => {
        const { onSelect, surface } = renderOverlay();
        const file = new File(['image'], 'photo.png', { type: 'image/png' });

        fireEvent.dragEnter(surface, { dataTransfer: dragData([file]) });
        hoverTarget(surface, 'gallery');
        fireEvent.dragOver(surface, {
            clientX: 1000,
            clientY: 1000,
            dataTransfer: dragData([file])
        });
        fireEvent.drop(surface, {
            clientX: 1000,
            clientY: 1000,
            dataTransfer: dragData([file])
        });

        expect(onSelect).not.toHaveBeenCalled();
    });
});
