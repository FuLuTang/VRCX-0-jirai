import { UploadIcon } from 'lucide-react';
import type { DragEvent, ReactNode } from 'react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { GalleryUploadTarget } from '@/features/tools/galleryConstants';

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

function hasFiles(event: DragEvent<HTMLElement>) {
    return Array.from(event.dataTransfer?.types || []).includes('Files');
}

function getSingleImageFile(event: DragEvent<HTMLElement>) {
    const files = event.dataTransfer?.files;
    if (!files || files.length !== 1) {
        return null;
    }
    const file = files[0];
    return file.type.startsWith('image/') ? file : null;
}

export function FeedImageDropOverlay({
    children,
    onSelect
}: FeedImageDropOverlayProps) {
    const { t } = useTranslation();
    const [isDragging, setIsDragging] = useState(false);
    const [hoveredTarget, setHoveredTarget] =
        useState<FeedImageDropTarget | null>(null);
    const hoveredTargetRef = useRef<FeedImageDropTarget | null>(null);
    const dragEnterCount = useRef(0);
    const targetRefs = useRef<
        Partial<Record<FeedImageDropTarget, HTMLDivElement | null>>
    >({});

    function resetDragState() {
        dragEnterCount.current = 0;
        setIsDragging(false);
        hoveredTargetRef.current = null;
        setHoveredTarget(null);
    }

    function updateHoveredTarget(event: DragEvent<HTMLElement>) {
        const eventTarget = event.target;
        const directTarget =
            eventTarget instanceof Element
                ? eventTarget.closest<HTMLElement>('[data-drop-target]')
                : null;
        const targetFromElement = directTarget?.dataset.dropTarget;
        const target = FEED_IMAGE_DROP_TARGETS.includes(
            targetFromElement as FeedImageDropTarget
        )
            ? (targetFromElement as FeedImageDropTarget)
            : FEED_IMAGE_DROP_TARGETS.find((value) => {
                  const element = targetRefs.current[value];
                  if (!element) {
                      return false;
                  }
                  const bounds = element.getBoundingClientRect();
                  return (
                      event.clientX >= bounds.left &&
                      event.clientX <= bounds.right &&
                      event.clientY >= bounds.top &&
                      event.clientY <= bounds.bottom
                  );
              }) || null;
        hoveredTargetRef.current = target;
        setHoveredTarget(target);
    }

    function onDragEnter(event: DragEvent<HTMLElement>) {
        if (!hasFiles(event)) {
            return;
        }
        event.preventDefault();
        dragEnterCount.current += 1;
        setIsDragging(true);
    }

    function onDragOver(event: DragEvent<HTMLElement>) {
        if (!hasFiles(event)) {
            return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        updateHoveredTarget(event);
    }

    function onDragLeave(event: DragEvent<HTMLElement>) {
        if (!hasFiles(event)) {
            return;
        }
        dragEnterCount.current = Math.max(0, dragEnterCount.current - 1);
        if (dragEnterCount.current === 0) {
            resetDragState();
        }
    }

    function onDrop(event: DragEvent<HTMLElement>) {
        event.preventDefault();
        const file = getSingleImageFile(event);
        const target = hoveredTargetRef.current;
        resetDragState();
        if (!file || !target) {
            return;
        }
        onSelect(file, target);
    }

    return (
        <div
            className="relative h-full min-h-0 min-w-0"
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
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
