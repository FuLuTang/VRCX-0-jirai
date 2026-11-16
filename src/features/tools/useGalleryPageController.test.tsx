// @vitest-environment jsdom

import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { GalleryUploadTarget } from './galleryConstants';
import { useGalleryPageController } from './useGalleryPageController';

const mocks = vi.hoisted(() => ({
    openCropRequest: vi.fn(),
    refreshAll: vi.fn(),
    refreshMediaProfile: vi.fn().mockResolvedValue(null)
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('@/services/toastService', () => ({
    toast: { add: vi.fn() }
}));
vi.mock('@/platform/tauri/bindings', () => ({
    commands: {}
}));
vi.mock('@/components/file-drop/useFileDropTarget', () => ({
    useFileDropTarget: () => false
}));
vi.mock('@/components/keyboard/useImagePasteShortcut', () => ({
    useImagePasteShortcut: () => ({ current: null })
}));
vi.mock('./galleryAuthTarget', () => ({
    isRuntimeAuthTarget: () => true
}));
vi.mock('./useGalleryActions', () => ({
    useGalleryActions: () => ({
        refreshTab: vi.fn(),
        refreshAll: mocks.refreshAll,
        getAuthTarget: () => ({
            userId: 'usr_self',
            endpoint: 'https://api.vrchat.cloud'
        }),
        openCropRequest: mocks.openCropRequest,
        confirmCroppedUpload: vi.fn(),
        deleteFileAsset: vi.fn(),
        deletePrint: vi.fn(),
        setProfileField: vi.fn(),
        consumeInventoryBundle: vi.fn(),
        redeemReward: vi.fn()
    })
}));
vi.mock('./useGalleryBulkActions', () => ({
    useGalleryBulkActions: () => ({
        bulkRunning: false,
        deleteSelection: vi.fn(),
        setFavoriteSelection: vi.fn()
    })
}));
vi.mock('./useGalleryRuntimeState', () => ({
    useGalleryRuntimeState: () => ({
        currentEndpoint: 'https://api.vrchat.cloud',
        currentUserId: 'usr_self',
        isVrcPlusSupporter: true,
        openImagePreview: vi.fn(),
        bannerCustomUrl: '',
        mediaProfile: null,
        mediaProfileLoading: false,
        mediaProfileError: '',
        refreshMediaProfile: mocks.refreshMediaProfile,
        userIcon: ''
    })
}));

beforeEach(() => {
    vi.clearAllMocks();
});

describe('useGalleryPageController Feed drop intake', () => {
    it.each<GalleryUploadTarget>([
        'gallery',
        'icons',
        'emojis',
        'stickers',
        'prints'
    ])(
        'hands the same File to the %s crop flow and consumes route state',
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

            const { result } = renderHook(
                () => ({
                    controller: useGalleryPageController(),
                    location: useLocation()
                }),
                { wrapper }
            );

            await waitFor(() => {
                expect(mocks.openCropRequest).toHaveBeenCalledTimes(1);
            });
            expect(mocks.openCropRequest).toHaveBeenCalledWith(
                file,
                target,
                expect.objectContaining({ userId: 'usr_self' })
            );
            await waitFor(() => {
                expect(result.current.location.state).toBeNull();
            });
            expect(mocks.refreshAll).toHaveBeenCalled();
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
