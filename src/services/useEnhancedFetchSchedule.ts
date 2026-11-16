import { useEffect, useState } from 'react';

import {
    commands,
    type RuntimeBackgroundJobSnapshot
} from '@/platform/tauri/bindings';
import { useRuntimeStore } from '@/state/runtimeStore';

// No deadline is synthesized: nextRunAt is copied from native job telemetry.
export function useEnhancedFetchSchedule(open: boolean, accountId: string) {
    const session = useRuntimeStore(
        (state) => state.authenticatedSession.session
    );
    const generation = session?.authScopeGeneration;
    const endpoint = session?.endpoint;
    const [state, setState] = useState<{
        scope: string;
        jobs: RuntimeBackgroundJobSnapshot[];
        error: boolean;
    } | null>(null);
    const scope = JSON.stringify([accountId, generation, endpoint]);
    useEffect(() => {
        if (!open || !accountId || generation == null) return;
        let disposed = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        async function poll() {
            try {
                const result =
                    await commands.appBackendRuntimeCombinedSnapshotGet();
                const nativeSession = result.authenticatedSession.session;
                if (
                    !disposed &&
                    nativeSession?.userId === accountId &&
                    nativeSession.authScopeGeneration === generation &&
                    nativeSession.endpoint === endpoint
                ) {
                    setState({
                        scope,
                        jobs: (result.backgroundJobs || []).filter(
                            (job) =>
                                job.name === 'backgroundSocialBaselineRefresh'
                        ),
                        error: false
                    });
                } else if (!disposed)
                    setState({ scope, jobs: [], error: false });
            } catch {
                if (!disposed) setState({ scope, jobs: [], error: true });
            } finally {
                if (!disposed) timer = setTimeout(() => void poll(), 10_000);
            }
        }
        void poll();
        return () => {
            disposed = true;
            clearTimeout(timer);
        };
    }, [open, accountId, generation, endpoint, scope]);
    return open && state?.scope === scope ? state : null;
}
