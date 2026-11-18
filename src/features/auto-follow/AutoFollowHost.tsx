import { useEffect } from 'react';

import { subscribeRuntimeEvent } from '@/services/runtime-event-bridge/subscription';

import { AutoFollowDialog } from './AutoFollowDialog';
import {
    handleAutoFollowTriggered,
    refreshAutoFollowStatus,
    stopAutoFollow
} from './autoFollowService';
import {
    closeAutoFollowDialog,
    openAutoFollowDialog,
    useAutoFollowStore
} from './autoFollowStore';

const DEV_HANDLE = '__VRCX_JIRAI_AUTO_FOLLOW__';

type AutoFollowDevHandle = {
    open: typeof openAutoFollowDialog;
    close: typeof closeAutoFollowDialog;
    stop: typeof stopAutoFollow;
    status: typeof refreshAutoFollowStatus;
};

/**
 * Development builds only: expose the opener on window so a tester can open the
 * hidden dialog from the devtools console. Production builds have no handle,
 * so the feature stays without any reachable entry (A7-17).
 */
export function installAutoFollowDevHandle(
    target: Record<string, unknown>,
    isDev: boolean
): () => void {
    if (!isDev) {
        return () => undefined;
    }
    const handle: AutoFollowDevHandle = {
        open: openAutoFollowDialog,
        close: closeAutoFollowDialog,
        stop: stopAutoFollow,
        status: refreshAutoFollowStatus
    };
    target[DEV_HANDLE] = handle;
    return () => {
        if (target[DEV_HANDLE] === handle) {
            delete target[DEV_HANDLE];
        }
    };
}

/**
 * Global host for #7 auto follow (jirai MainLayout mounts AutoFollowDialog the
 * same way). It renders no visible entry point (A7-17): the dialog only opens
 * through openAutoFollowDialog().
 */
export function AutoFollowHost() {
    const open = useAutoFollowStore((state) => state.open);
    const setOpen = useAutoFollowStore((state) => state.setOpen);

    useEffect(
        () =>
            installAutoFollowDevHandle(
                window as unknown as Record<string, unknown>,
                import.meta.env.DEV
            ),
        []
    );

    useEffect(() => {
        if (open) {
            void refreshAutoFollowStatus().catch(() => undefined);
        }
    }, [open]);

    useEffect(() => {
        let disposed = false;
        let unsubscribe: (() => void) | null = null;
        void subscribeRuntimeEvent('autoFollowTriggered', (payload) => {
            void handleAutoFollowTriggered(payload);
        })
            .then((dispose) => {
                if (disposed) {
                    dispose();
                } else {
                    unsubscribe = dispose;
                }
            })
            .catch(() => undefined);
        return () => {
            disposed = true;
            unsubscribe?.();
        };
    }, []);

    if (!open) {
        return null;
    }
    return <AutoFollowDialog open={open} onOpenChange={setOpen} />;
}
