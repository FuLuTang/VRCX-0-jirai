// @vitest-environment jsdom

import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { GalleryUploadTarget } from './galleryConstants';
import { useGalleryPageController } from './useGalleryPageController';

const mocks = vi.hoisted(() => ({
    prepareUploadFile: vi.fn(),
    refreshAll: vi.fn(),
    refreshMediaProfile: vi.fn().mockResolvedValue(null)
}));

vi.mock('./useGalleryActions', () => ({
    useGalleryActions: () => ({
        prepareUploadFile: mocks.prepareUploadFile,
        refreshAll: mocks.refreshAll
    })
}));
vi.mock('./useGalleryBulkActions', () => ({
    useGalleryBulkActions: () => ({ bulkRunning: false })
}));
vi.mock('./useGalleryRuntimeState', () => ({
    useGalleryRuntimeState: () => ({
        currentEndpoint: 'https://api.vrchat.cloud',
        currentUserId: 'usr_self',
        isVrcPlusSupporter: true,
        mediaProfile: null,
        refreshMediaProfile: mocks.refreshMediaProfile
    })
}));

beforeEach(() => {
    vi.clearAllMocks();
});

describe('useGalleryPageController Feed drop', () => {
    it.each<GalleryUploadTarget>([
        'gallery',
        'icons',
        'emojis',
        'stickers',
        'prints'
    ])(
        'passes the same File to the %s upload and consumes route state',
        async (target) => {
            const file = new File(['image'], 'drop.png', { type: 'image/png' });
            const wrapper = ({ children }: { children: ReactNode }) => (
                <MemoryRouter
                    initialEntries={[
                        {
                            pathname: '/tools/gallery',
                            state: { feedImageDrop: { file, target } }
                        }
                    ]}
                >
                    {children}
                </MemoryRouter>
            );

            const { result, rerender } = renderHook(
                () => ({
                    controller: useGalleryPageController(),
                    location: useLocation()
                }),
                { wrapper }
            );

            await waitFor(() => {
                expect(result.current.location.state).toBeNull();
            });
            expect(mocks.prepareUploadFile).toHaveBeenCalledExactlyOnceWith(
                file,
                target
            );
            expect(result.current.controller.activeTab).toBe(
                target === 'icons' || target === 'prints' ? target : 'gallery'
            );
            expect(mocks.refreshAll).toHaveBeenCalled();

            rerender();
            expect(mocks.prepareUploadFile).toHaveBeenCalledTimes(1);
        }
    );

    it('keeps the current branch refresh-all profile behavior', () => {
        const wrapper = ({ children }: { children: ReactNode }) => (
            <MemoryRouter initialEntries={['/tools/gallery']}>
                {children}
            </MemoryRouter>
        );
        const { result } = renderHook(() => useGalleryPageController(), {
            wrapper
        });

        result.current.refreshAll();

        expect(mocks.refreshAll).toHaveBeenCalledTimes(2);
        expect(mocks.refreshMediaProfile).toHaveBeenCalledTimes(1);
    });
});
