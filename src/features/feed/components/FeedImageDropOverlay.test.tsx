// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    FEED_IMAGE_DROP_TARGETS,
    FeedImageDropOverlay
} from './FeedImageDropOverlay';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

afterEach(() => {
    cleanup();
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
        fireEvent.drop(surface, { dataTransfer: dragData([file]) });

        expect(onSelect).toHaveBeenCalledWith(file, 'stickers');
    });

    it.each([
        { files: [], label: 'empty' },
        {
            files: [new File(['text'], 'notes.txt', { type: 'text/plain' })],
            label: 'non-image'
        },
        {
            files: [
                new File(['one'], 'one.png', { type: 'image/png' }),
                new File(['two'], 'two.png', { type: 'image/png' })
            ],
            label: 'multi-file'
        }
    ])('rejects $label drops', ({ files }) => {
        const { onSelect, surface } = renderOverlay();

        fireEvent.dragEnter(surface, { dataTransfer: dragData(files) });
        hoverTarget(surface, 'gallery');
        fireEvent.drop(surface, { dataTransfer: dragData(files) });

        expect(onSelect).not.toHaveBeenCalled();
    });
});
