import { Link2Icon, UsersIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { preserveAppTitleBarOnOpenChange } from '@/lib/overlayTitlebar';
import { Button } from '@/ui/shadcn/button';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger
} from '@/ui/shadcn/sheet';

import type {
    MutualFriendManualLink,
    MutualFriendPickerOption,
    MutualFriendTrackedUser
} from '../../mutual-friends/mutualFriendsTypes';
import { MutualFriendsRelationsManager } from './MutualFriendsRelationsManager';

interface ManagementProps {
    manualLinks: MutualFriendManualLink[];
    onSetManualLink: (
        userIdA: string,
        userIdB: string,
        related: boolean
    ) => void;
    onSetTrackedUser: (
        userId: string,
        displayName: string,
        tracked: boolean
    ) => void;
    options: MutualFriendPickerOption[];
    trackedUsers: MutualFriendTrackedUser[];
}

export function MutualFriendsManagementSheets(props: ManagementProps) {
    const { t } = useTranslation();

    return (
        <>
            <Sheet
                modal="trap-focus"
                onOpenChange={(open, details) =>
                    preserveAppTitleBarOnOpenChange(open, details)
                }
            >
                <SheetTrigger
                    render={
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t(
                                'view.charts.mutual_friend.manual.title'
                            )}
                            title={t('view.charts.mutual_friend.manual.title')}
                        >
                            <Link2Icon />
                        </Button>
                    }
                />
                <SheetContent
                    side="right"
                    variant="inset"
                    showCloseButton
                    className="w-90 gap-0"
                >
                    <SheetHeader className="border-border/60 shrink-0 border-b">
                        <SheetTitle>
                            {t('view.charts.mutual_friend.manual.title')}
                        </SheetTitle>
                    </SheetHeader>
                    <div className="min-h-0 flex-1 overflow-y-auto p-4">
                        <MutualFriendsRelationsManager
                            {...props}
                            mode="manual"
                        />
                    </div>
                </SheetContent>
            </Sheet>

            <Sheet
                modal="trap-focus"
                onOpenChange={(open, details) =>
                    preserveAppTitleBarOnOpenChange(open, details)
                }
            >
                <SheetTrigger
                    render={
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t(
                                'view.charts.mutual_friend.tracked.title'
                            )}
                            title={t('view.charts.mutual_friend.tracked.title')}
                        >
                            <UsersIcon />
                        </Button>
                    }
                />
                <SheetContent
                    side="right"
                    variant="inset"
                    showCloseButton
                    className="w-90 gap-0"
                >
                    <SheetHeader className="border-border/60 shrink-0 border-b">
                        <SheetTitle>
                            {t('view.charts.mutual_friend.tracked.title')}
                        </SheetTitle>
                    </SheetHeader>
                    <div className="min-h-0 flex-1 overflow-y-auto p-4">
                        <MutualFriendsRelationsManager
                            {...props}
                            mode="tracked"
                        />
                    </div>
                </SheetContent>
            </Sheet>
        </>
    );
}
