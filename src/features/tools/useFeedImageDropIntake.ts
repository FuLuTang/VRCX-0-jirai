import { useEffect, useEffectEvent, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';

import { toast } from '@/services/toastService';

import {
    canUploadGalleryTarget,
    TAB_ORDER,
    type GalleryTab,
    type GalleryUploadTarget
} from './galleryConstants';
import type { GalleryAuthTarget, GalleryPendingUpload } from './galleryTypes';
import { validateImageFile } from './inventoryHelpers';

const FEED_DROP_TARGETS: readonly GalleryUploadTarget[] = [
    'gallery',
    'icons',
    'emojis',
    'stickers',
    'prints'
];

export function readFeedImageDrop(state: unknown): GalleryPendingUpload | null {
    if (!state || typeof state !== 'object') {
        return null;
    }
    const drop = (state as { feedImageDrop?: unknown }).feedImageDrop;
    if (!drop || typeof drop !== 'object') {
        return null;
    }
    const { file, target } = drop as Partial<GalleryPendingUpload>;
    if (
        !(file instanceof File) ||
        !target ||
        !FEED_DROP_TARGETS.includes(target)
    ) {
        return null;
    }
    return { file, target };
}

function isGalleryTab(target: GalleryUploadTarget): target is GalleryTab {
    return (TAB_ORDER as readonly string[]).includes(target);
}

/**
 * Consumes an image the user dropped on the Feed page (Jirai feature) and
 * hands it to the Gallery crop flow once the page can accept uploads. The
 * router state is cleared in the same navigation that selects the target tab,
 * so a reload or back navigation never re-opens the same upload.
 */
export function useFeedImageDropIntake({
    enabled,
    isVrcPlusSupporter,
    getAuthTarget,
    isCurrentAuthTarget,
    openCropRequest
}: {
    enabled: boolean;
    isVrcPlusSupporter: boolean;
    getAuthTarget(): GalleryAuthTarget;
    isCurrentAuthTarget(authTarget: GalleryAuthTarget): boolean;
    openCropRequest(
        file: File,
        target: GalleryUploadTarget,
        authTarget: GalleryAuthTarget
    ): void;
}) {
    const { t } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const processedFileRef = useRef<File | null>(null);
    const pending = useMemo(
        () => readFeedImageDrop(location.state),
        [location.state]
    );

    const consume = useEffectEvent((drop: GalleryPendingUpload) => {
        const nextParams = new URLSearchParams(location.search);
        if (isGalleryTab(drop.target)) {
            if (drop.target === TAB_ORDER[0]) {
                nextParams.delete('tab');
            } else {
                nextParams.set('tab', drop.target);
            }
        }
        const search = nextParams.toString();
        navigate(
            { pathname: location.pathname, search: search ? `?${search}` : '' },
            { replace: true, state: null }
        );
        if (!canUploadGalleryTarget(drop.target, isVrcPlusSupporter)) {
            toast.add({ type: 'error', title: t('message.vrcplus.required') });
            return;
        }
        if (!validateImageFile(drop.file, t)) {
            return;
        }
        const authTarget = getAuthTarget();
        if (isCurrentAuthTarget(authTarget)) {
            openCropRequest(drop.file, drop.target, authTarget);
        }
    });

    useEffect(() => {
        if (!enabled || !pending || processedFileRef.current === pending.file) {
            return;
        }
        processedFileRef.current = pending.file;
        consume(pending);
    }, [enabled, pending]);
}
