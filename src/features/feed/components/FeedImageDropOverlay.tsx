import { UploadIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { GalleryUploadTarget } from '@/features/tools/galleryConstants';
import { readDroppedUploadImage } from '@/features/tools/inventoryHelpers';
import {
    onFileDragDrop,
    type FileDragDropEvent
} from '@/platform/tauri/fileDrop';

export const FEED_IMAGE_DROP_TARGETS = [
    'gallery',
    'icons',
    'emojis',
    'stickers',
    'prints'
] as const satisfies readonly GalleryUploadTarget[];

export type FeedImageDropTarget = (typeof FEED_IMAGE_DROP_TARGETS)[number];

type FeedImageDropOverlayProps = {
    children: ReactNode;
    onSelect(file: File, target: FeedImageDropTarget): void;
};

type DropPosition = { x: number; y: number };

/**
 * Converts the physical window position reported by the Tauri drag-drop
 * event into CSS pixels, the space getBoundingClientRect() reports in.
 */
function toCssPoint(position: DropPosition) {
    const scale = window.devicePixelRatio || 1;
    return { x: position.x / scale, y: position.y / scale };
}

/**
 * Shows five Gallery upload targets over the Feed while files are dragged
 * onto the window and forwards a single dropped image with its target.
 *
 * Tauri intercepts OS file drags (dragDropEnabled), so the webview never
 * receives DOM drop events with files; the overlay listens to the native
 * drag-drop events instead, like the Gallery page's own drop intake.
 */
export function FeedImageDropOverlay({
    children,
    onSelect
}: FeedImageDropOverlayProps) {
    const { t } = useTranslation();
    const [isDragging, setIsDragging] = useState(false);
    const [hoveredTarget, setHoveredTarget] =
        useState<FeedImageDropTarget | null>(null);
    const hoveredTargetRef = useRef<FeedImageDropTarget | null>(null);
    const targetRefs = useRef<
        Partial<Record<FeedImageDropTarget, HTMLDivElement | null>>
    >({});

    function resetDragState() {
        setIsDragging(false);
        hoveredTargetRef.current = null;
        setHoveredTarget(null);
    }

    function targetAt(position: DropPosition) {
        const point = toCssPoint(position);
        return (
            FEED_IMAGE_DROP_TARGETS.find((value) => {
                const element = targetRefs.current[value];
                if (!element) {
                    return false;
                }
                const bounds = element.getBoundingClientRect();
                return (
                    point.x >= bounds.left &&
                    point.x <= bounds.right &&
                    point.y >= bounds.top &&
                    point.y <= bounds.bottom
                );
            }) || null
        );
    }

    function updateHoveredTarget(position: DropPosition) {
        const target = targetAt(position);
        hoveredTargetRef.current = target;
        setHoveredTarget(target);
    }

    const handleDragDrop = useEffectEvent(async (event: FileDragDropEvent) => {
        if (event.type === 'enter') {
            setIsDragging(event.paths.length > 0);
            updateHoveredTarget(event.position);
            return;
        }
        if (event.type === 'over') {
            updateHoveredTarget(event.position);
            return;
        }
        if (event.type === 'leave') {
            resetDragState();
            return;
        }
        const target = targetAt(event.position) || hoveredTargetRef.current;
        resetDragState();
        if (event.paths.length !== 1 || !target) {
            return;
        }
        const file = await readDroppedUploadImage(event.paths, t);
        if (file) {
            onSelect(file, target);
        }
    });

    useEffect(() => {
        let disposed = false;
        let unlisten: (() => void) | null = null;
        onFileDragDrop((event) => {
            void handleDragDrop(event);
        })
            .then((stop) => {
                if (disposed) {
                    stop();
                } else {
                    unlisten = stop;
                }
            })
            .catch((error: unknown) => {
                console.error('Failed to listen for Feed image drops:', error);
            });
        return () => {
            disposed = true;
            unlisten?.();
        };
    }, []);

    return (
        <div
            className="relative h-full min-h-0 min-w-0"
            data-testid="feed-image-drop-surface"
        >
            {children}
            {isDragging ? (
                <div
                    className="bg-background/80 pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-[var(--radius)] backdrop-blur-sm"
                    data-testid="feed-image-drop-overlay"
                >
                    <div className="flex w-full max-w-4xl flex-wrap justify-center gap-6 p-8">
                        {FEED_IMAGE_DROP_TARGETS.map((target) => (
                            <div
                                key={target}
                                ref={(element) => {
                                    targetRefs.current[target] = element;
                                }}
                                className={`text-foreground flex aspect-square w-[28%] flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 transition-all duration-300 ${
                                    hoveredTarget === target
                                        ? 'border-primary bg-primary/20 text-primary shadow-[0_12px_30px_-10px_rgba(var(--primary-rgb),0.5)]'
                                        : 'border-primary/40 bg-card/80'
                                }`}
                                aria-label={t(`dialog.gallery_icons.${target}`)}
                                data-drop-target={target}
                            >
                                <UploadIcon className="mb-2 size-8" />
                                <span className="text-center text-sm font-semibold">
                                    {t(`dialog.gallery_icons.${target}`)}
                                </span>
                                <span className="mt-1 text-center text-xs opacity-70">
                                    {t('dialog.gallery_icons.drop_to_upload')}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
