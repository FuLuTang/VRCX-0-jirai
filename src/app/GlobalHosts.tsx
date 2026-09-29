import { lazy } from 'react';

import { AppToaster } from '@/components/hosts/AppToaster';
import { BackgroundRouteResumeHost } from '@/components/hosts/BackgroundRouteResumeHost';
import { CommunityThemeSafetyHost } from '@/components/hosts/CommunityThemeSafetyHost';
import { DialogHost } from '@/components/hosts/DialogHost';
import { FriendProfileLoadHost } from '@/components/hosts/FriendProfileLoadHost';
import { LaunchDialogHost } from '@/components/hosts/LaunchDialogHost';
import { LinuxRenderingTrialHost } from '@/components/hosts/LinuxRenderingTrialHost';
import { ModalHost } from '@/components/hosts/ModalHost';
import { MountOnFirstOpen } from '@/components/hosts/MountOnFirstOpen';
import { NotificationHost } from '@/components/hosts/NotificationHost';
import { PostUpdateChangelogToastHost } from '@/components/hosts/PostUpdateChangelogToastHost';
import { PreviousInstancesDialogHost } from '@/components/hosts/PreviousInstancesDialogHost';
import { SystemDialogsHost } from '@/components/hosts/SystemDialogsHost';
import { ToolsDialogsHost } from '@/components/hosts/ToolsDialogsHost';
import { AssistantDialogHost } from '@/features/assistant/AssistantDialogHost';
import { VrcNotificationCenterHost } from '@/features/notifications/VrcNotificationCenterHost';
import { PrivacyLockDialogHost } from '@/features/privacy-lock/PrivacyLockDialogHost';
import { PrivacyLockOverlay } from '@/features/privacy-lock/PrivacyLockOverlay';
import { useRuntimeStore } from '@/state/runtimeStore';

const SyncWorkflowDialog = lazy(() =>
    import('@/features/workflows/SyncWorkflowDialog').then((module) => ({
        default: module.SyncWorkflowDialog
    }))
);

function SyncWorkflowHost() {
    const open = useRuntimeStore((state) => state.systemHosts.syncWorkflowOpen);
    const accountId = useRuntimeStore(
        (state) => state.auth.currentUserId ?? ''
    );
    const accountLabel = useRuntimeStore(
        (state) =>
            state.auth.currentUserDisplayName || state.auth.currentUserId || ''
    );
    const setSystemHostOpen = useRuntimeStore(
        (state) => state.setSystemHostOpen
    );
    return (
        <MountOnFirstOpen open={open}>
            <SyncWorkflowDialog
                open={open}
                onOpenChange={(nextOpen) =>
                    setSystemHostOpen('syncWorkflowOpen', nextOpen)
                }
                accountId={accountId}
                accountLabel={accountLabel}
            />
        </MountOnFirstOpen>
    );
}

export function GlobalHosts() {
    return (
        <>
            <AppToaster />
            <CommunityThemeSafetyHost />
            <BackgroundRouteResumeHost />
            <ModalHost />
            <DialogHost />
            <LinuxRenderingTrialHost />
            <FriendProfileLoadHost />
            <NotificationHost />
            <VrcNotificationCenterHost />
            <PostUpdateChangelogToastHost />
            <LaunchDialogHost />
            <PreviousInstancesDialogHost />
            <SystemDialogsHost />
            <ToolsDialogsHost />
            <SyncWorkflowHost />
            <AssistantDialogHost />
            <PrivacyLockDialogHost />
            <PrivacyLockOverlay />
        </>
    );
}
