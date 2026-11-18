import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Location } from '@/components/Location';
import { UserStatusAvatar } from '@/components/UserStatusAvatar';
import { presenceDotClassName } from '@/domain/friends/presence';
import { userImage } from '@/shared/utils/entityMedia';
import { useFavoriteStore } from '@/state/favoriteStore';
import { useFriendRosterStore } from '@/state/friendRosterStore';
import { usePreferencesStore } from '@/state/preferencesStore';
import { Button } from '@/ui/shadcn/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/ui/shadcn/dialog';

import {
    buildAutoFollowFavoriteIdSet,
    candidateShowsLocation,
    selectAutoFollowCandidates,
    type AutoFollowCandidate
} from './autoFollowModel';
import { startAutoFollow, stopAutoFollow } from './autoFollowService';
import { useAutoFollowStore } from './autoFollowStore';

function CandidateRow({
    candidate,
    onSelect
}: {
    candidate: AutoFollowCandidate;
    onSelect(candidate: AutoFollowCandidate): void;
}) {
    return (
        <button
            type="button"
            className="hover:bg-accent flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left"
            data-testid="auto-follow-candidate"
            onClick={() => onSelect(candidate)}
        >
            <UserStatusAvatar
                className="size-8"
                imageUrl={userImage(candidate.friend)}
                statusDotClassName={presenceDotClassName(
                    candidate.friend.$presence,
                    candidate.status
                )}
            />
            <span className="flex min-w-0 flex-1 flex-col">
                <span
                    className="truncate text-sm"
                    style={
                        candidate.userColour
                            ? { color: candidate.userColour }
                            : undefined
                    }
                >
                    {candidate.displayName}
                </span>
                <span className="text-muted-foreground truncate text-xs">
                    {candidateShowsLocation(candidate) ? (
                        <Location
                            location={candidate.location}
                            traveling={candidate.travelingTo}
                            link={false}
                        />
                    ) : (
                        candidate.statusDescription || candidate.status
                    )}
                </span>
            </span>
        </button>
    );
}

export function AutoFollowDialog({
    open,
    onOpenChange
}: {
    open: boolean;
    onOpenChange(open: boolean): void;
}) {
    const { t } = useTranslation();
    const status = useAutoFollowStore((state) => state.status);
    const onlineIds = useFriendRosterStore((state) => state.onlineIds);
    const friendsById = useFriendRosterStore((state) => state.friendsById);
    const favoriteFriendIds = useFavoriteStore(
        (state) => state.favoriteFriendIds
    );
    const groupedFavoriteFriendIdsByGroupKey = useFavoriteStore(
        (state) => state.groupedFavoriteFriendIdsByGroupKey
    );
    const localFriendFavorites = useFavoriteStore(
        (state) => state.localFriendFavorites
    );
    const localFavoriteFriendsGroups = usePreferencesStore(
        (state) => state.localFavoriteFriendsGroups
    );

    const candidates = useMemo(() => {
        const favoriteIds = buildAutoFollowFavoriteIdSet({
            favoriteFriendIds,
            groupedFavoriteFriendIdsByGroupKey,
            localFriendFavorites,
            localFavoriteFriendsGroups
        });
        return selectAutoFollowCandidates({
            onlineIds,
            friendsById,
            favoriteIds
        });
    }, [
        favoriteFriendIds,
        friendsById,
        groupedFavoriteFriendIdsByGroupKey,
        localFavoriteFriendsGroups,
        localFriendFavorites,
        onlineIds
    ]);

    const handleSelect = (candidate: AutoFollowCandidate) => {
        void startAutoFollow(candidate.id, candidate.displayName);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{t('jirai.auto_follow.title')}</DialogTitle>
                    <DialogDescription>
                        {t('jirai.auto_follow.description')}
                    </DialogDescription>
                </DialogHeader>
                {status.active ? (
                    <div
                        className="bg-muted flex items-center gap-2 rounded-md px-3 py-2 text-sm"
                        data-testid="auto-follow-current"
                    >
                        <span className="min-w-0 flex-1 truncate">
                            {t('jirai.auto_follow.current_target', {
                                name:
                                    status.targetDisplayName ||
                                    status.targetUserId ||
                                    ''
                            })}
                        </span>
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => void stopAutoFollow()}
                        >
                            {t('jirai.auto_follow.stop')}
                        </Button>
                    </div>
                ) : null}
                <div className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto">
                    {candidates.length ? (
                        candidates.map((candidate) => (
                            <CandidateRow
                                key={candidate.id}
                                candidate={candidate}
                                onSelect={handleSelect}
                            />
                        ))
                    ) : (
                        <div className="text-muted-foreground py-6 text-center text-sm">
                            {t('jirai.auto_follow.empty')}
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        {t('common.actions.close')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
