import { useEffect } from 'react';

import { subscribeRuntimeEvent } from '@/services/runtime-event-bridge/subscription';

import { AutoFollowDialog } from './AutoFollowDialog';
import { handleAutoFollowTriggered } from './autoFollowService';
import { useAutoFollowStore } from './autoFollowStore';

/**
 * Global host for #7 auto follow (jirai MainLayout mounts AutoFollowDialog the
 * same way). It renders no visible entry point (A7-17): the dialog only opens
 * through openAutoFollowDialog().
 */
export function AutoFollowHost() {
    const open = useAutoFollowStore((state) => state.open);
    const setOpen = useAutoFollowStore((state) => state.setOpen);

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
