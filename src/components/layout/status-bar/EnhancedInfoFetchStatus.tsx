import { useTranslation } from 'react-i18next';

import { useEnhancedInfoFetchSnapshot } from '@/lib/useEnhancedInfoFetchSnapshot';
import { useRuntimeStore } from '@/state/runtimeStore';

import { StatusSegment } from './StatusBarParts';

export function EnhancedInfoFetchStatus() {
    const { t } = useTranslation();
    const snapshot = useEnhancedInfoFetchSnapshot();
    const accountId = useRuntimeStore((state) => state.auth.currentUserId);
    const setSystemHostOpen = useRuntimeStore(
        (state) => state.setSystemHostOpen
    );
    const current = Boolean(accountId) && snapshot.accountId === accountId;
    const phase = current ? snapshot.phase : 'idle';
    const cancelled = phase === 'cancelled';
    const hourlyRunning = current && snapshot.running && !cancelled;
    const displayPhase = t(`enhanced_info_fetch.phase.${phase}`);
    return (
        <StatusSegment
            label={t('view.tools.system_tools.info_completion')}
            active={hourlyRunning}
            warn={
                phase === 'paused' ||
                phase === 'error' ||
                (current &&
                    (snapshot.failed > 0 ||
                        snapshot.relationshipStatus === 'error'))
            }
            value={
                current && snapshot.total > 0
                    ? `${snapshot.processed}/${snapshot.total}`
                    : displayPhase
            }
            tooltip={t('enhanced_info_fetch.status_tooltip', {
                phase: displayPhase,
                succeeded: current ? snapshot.succeeded : 0,
                failed: current ? snapshot.failed : 0,
                incomplete: current ? snapshot.incomplete : 0
            })}
            onClick={() => setSystemHostOpen('syncWorkflowOpen', true)}
        />
    );
}
