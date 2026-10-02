import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';

import {
    EMPTY_ASSETS,
    sanitizeGalleryTab,
    TAB_ORDER,
    type GalleryTab,
    type GalleryUploadTarget
} from './galleryConstants';
import {
    getGalleryGridDensityConfig,
    sanitizeGalleryGridDensity,
    type GalleryGridDensity
} from './galleryDensity';
import type {
    GalleryAuthTarget,
    GalleryControllerDeps,
    GalleryCropRequest,
    GalleryPendingUpload
} from './galleryTypes';
import { useGalleryActions } from './useGalleryActions';
import { useGalleryBulkActions } from './useGalleryBulkActions';
import { useGalleryRuntimeState } from './useGalleryRuntimeState';

const GALLERY_GRID_DENSITY_STORAGE_KEY = 'VRCX_GalleryGridDensity';

function readFeedImageDrop(state: unknown): GalleryPendingUpload | null {
    if (!state || typeof state !== 'object') {
        return null;
    }
    const drop = (state as { feedImageDrop?: unknown }).feedImageDrop;
    if (!drop || typeof drop !== 'object') {
        return null;
    }
    const { file, target } = drop as Partial<GalleryPendingUpload>;
    if (
        typeof File === 'undefined' ||
        !(file instanceof File) ||
        !['gallery', 'icons', 'emojis', 'stickers', 'prints'].includes(
            target || ''
        )
    ) {
        return null;
    }
    return { file, target: target as GalleryUploadTarget };
}

function isGalleryTab(target: GalleryUploadTarget): target is GalleryTab {
    return target === 'gallery' || target === 'icons' || target === 'prints';
}

function readGalleryGridDensityPreference() {
    return sanitizeGalleryGridDensity(
        localStorage.getItem(GALLERY_GRID_DENSITY_STORAGE_KEY)
    );
}

function writeGalleryGridDensityPreference(value: GalleryGridDensity) {
    localStorage.setItem(GALLERY_GRID_DENSITY_STORAGE_KEY, value);
}

export function useGalleryPageController() {
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const uploadInputRef = useRef<HTMLInputElement | null>(null);
    const uploadTargetRef = useRef<GalleryUploadTarget>('gallery');
    const processedFeedDropFileRef = useRef<File | null>(null);
    const uploadAuthTargetRef = useRef<GalleryAuthTarget | null>(null);
    const {
        currentEndpoint,
        currentUserId,
        isVrcPlusSupporter,
        openImagePreview,
        bannerCustomUrl,
        mediaProfile,
        mediaProfileLoading,
        mediaProfileError,
        refreshMediaProfile,
        userIcon
    } = useGalleryRuntimeState();
    const [activeTab, setActiveTabState] = useState(() =>
        sanitizeGalleryTab(searchParams.get('tab'))
    );
    const [assets, setAssets] = useState(EMPTY_ASSETS);
    const [loadingByTab, setLoadingByTab] = useState<Record<string, boolean>>(
        {}
    );
    const [uploadingTab, setUploadingTab] = useState('');
    const [mutatingKey, setMutatingKey] = useState('');
    const [cropRequest, setCropRequest] = useState<GalleryCropRequest | null>(
        null
    );
    const [emojiAnimFps, setEmojiAnimFps] = useState(15);
    const [emojiAnimFrameCount, setEmojiAnimFrameCount] = useState(4);
    const [emojiAnimType, setEmojiAnimType] = useState(false);
    const [emojiAnimationStyle, setEmojiAnimationStyle] = useState('Stop');
    const [emojiAnimLoopPingPong, setEmojiAnimLoopPingPong] = useState(false);
    const [gridDensity, setGridDensity] = useState(() =>
        readGalleryGridDensityPreference()
    );
    const gridDensityConfig = useMemo(
        () => getGalleryGridDensityConfig(gridDensity),
        [gridDensity]
    );
    const tabCounts = useMemo(
        () => ({
            gallery: `${assets.gallery.length}/64`,
            icons: `${assets.icons.length}/64`,
            prints: `${assets.prints.length}/64`
        }),
        [assets.gallery.length, assets.icons.length, assets.prints.length]
    );
    const {
        refreshTab,
        refreshAll: refreshAllAssets,
        beginUpload,
        prepareUploadFile,
        uploadSelectedFile,
        confirmCroppedUpload,
        deleteFileAsset,
        deletePrint,
        setProfileField,
        consumeInventoryBundle,
        redeemReward
    } = useGalleryActions({
        activeTab,
        cropRequest,
        currentEndpoint,
        currentUserId,
        mediaProfile,
        refreshMediaProfile,
        emojiAnimFps,
        emojiAnimFrameCount,
        emojiAnimLoopPingPong,
        emojiAnimType,
        emojiAnimationStyle,
        isVrcPlusSupporter,
        setAssets,
        setCropRequest,
        setEmojiAnimFps,
        setEmojiAnimFrameCount,
        setEmojiAnimLoopPingPong,
        setEmojiAnimType,
        setEmojiAnimationStyle,
        setLoadingByTab,
        setMutatingKey,
        setUploadingTab,
        uploadAuthTargetRef,
        uploadInputRef,
        uploadTargetRef
    } satisfies GalleryControllerDeps);
    const { bulkRunning, deleteSelection, setFavoriteSelection } =
        useGalleryBulkActions({ setAssets });
    const pendingFeedDrop = useMemo(
        () => readFeedImageDrop(location.state),
        [location.state]
    );
    const refreshAllRef = useRef(refreshAllAssets);
    const setActiveTab = useCallback(
        (nextValue: string) => {
            const nextTab = sanitizeGalleryTab(nextValue);
            setActiveTabState(nextTab);
            setSearchParams(
                (currentParams) => {
                    const nextParams = new URLSearchParams(currentParams);
                    if (nextTab === TAB_ORDER[0]) {
                        nextParams.delete('tab');
                    } else {
                        nextParams.set('tab', nextTab);
                    }
                    return nextParams;
                },
                { replace: true }
            );
        },
        [setSearchParams]
    );
    useEffect(() => {
        refreshAllRef.current = refreshAllAssets;
    }, [refreshAllAssets]);

    useEffect(() => {
        if (
            !pendingFeedDrop ||
            processedFeedDropFileRef.current === pendingFeedDrop.file
        ) {
            return;
        }
        processedFeedDropFileRef.current = pendingFeedDrop.file;
        if (isGalleryTab(pendingFeedDrop.target)) {
            setActiveTab(pendingFeedDrop.target);
        } else {
            navigate(
                { pathname: location.pathname, search: location.search },
                { replace: true, state: null }
            );
        }
        prepareUploadFile(pendingFeedDrop.file, pendingFeedDrop.target);
    }, [
        location.pathname,
        location.search,
        navigate,
        pendingFeedDrop,
        prepareUploadFile,
        setActiveTab
    ]);

    useEffect(() => {
        setAssets(EMPTY_ASSETS);
        setLoadingByTab({});
        if (!currentUserId) {
            return;
        }
        refreshAllRef.current();
    }, [currentEndpoint, currentUserId]);

    useEffect(() => {
        const nextTab = sanitizeGalleryTab(searchParams.get('tab'));
        setActiveTabState((current) =>
            current === nextTab ? current : nextTab
        );
    }, [searchParams]);

    function changeGridDensity(nextValue: GalleryGridDensity) {
        setGridDensity(nextValue);
        writeGalleryGridDensityPreference(nextValue);
    }
    return {
        bulkRunning,
        deleteSelection,
        setFavoriteSelection,
        uploadInputRef,
        uploadingTab,
        uploadSelectedFile,
        gridDensity,
        changeGridDensity,
        navigate,
        refreshAll: () => {
            refreshAllAssets();
            void refreshMediaProfile().catch(() => {});
        },
        setActiveTab,
        beginUpload,
        setProfileField,
        consumeInventoryBundle,
        deleteFileAsset,
        deletePrint,
        setEmojiAnimationStyle,
        setEmojiAnimFps,
        setEmojiAnimFrameCount,
        setEmojiAnimLoopPingPong,
        setEmojiAnimType,
        redeemReward,
        refreshTab,
        activeTab,
        assets,
        currentUserId,
        emojiAnimFps,
        emojiAnimFrameCount,
        emojiAnimLoopPingPong,
        emojiAnimationStyle,
        emojiAnimType,
        gridDensityConfig,
        isVrcPlusSupporter,
        loadingByTab,
        mutatingKey,
        bannerCustomUrl,
        mediaProfileLoading,
        mediaProfileError,
        tabCounts,
        userIcon,
        cropRequest,
        setCropRequest,
        confirmCroppedUpload,
        openImagePreview,
        uploadAuthTargetRef
    };
}
