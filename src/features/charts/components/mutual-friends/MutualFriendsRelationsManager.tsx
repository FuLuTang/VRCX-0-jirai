import {
    Link2Icon,
    LoaderCircleIcon,
    Trash2Icon,
    UserPlusIcon,
    UserRoundMinusIcon
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FriendMultiSelectList } from '@/components/search/FriendMultiSelectList';
import vrchatFriendRepository from '@/repositories/vrchatFriendRepository';
import { Button } from '@/ui/shadcn/button';
import { Input } from '@/ui/shadcn/input';

import type {
    MutualFriendManualLink,
    MutualFriendPickerOption,
    MutualFriendTrackedUser
} from '../../mutual-friends/mutualFriendsTypes';

export function MutualFriendsRelationsManager({
    manualLinks,
    mode,
    onSetManualLink,
    onSetTrackedUser,
    options,
    trackedUsers
}: {
    mode: 'manual' | 'tracked';
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
}) {
    const { t } = useTranslation();
    const [userA, setUserA] = useState<string[]>([]);
    const [userB, setUserB] = useState<string[]>([]);
    const [trackedUserId, setTrackedUserId] = useState('');
    const [verifiedUser, setVerifiedUser] = useState<{
        id: string;
        displayName: string;
    } | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [verifyError, setVerifyError] = useState('');
    const labelById = new Map(
        options.map((option) => [option.value, option.label])
    );

    const addRelation = () => {
        const [idA] = userA;
        const [idB] = userB;
        if (!idA || !idB || idA === idB) {
            return;
        }
        onSetManualLink(idA, idB, true);
        setUserA([]);
        setUserB([]);
    };

    const verifyTrackedUser = async () => {
        const id = trackedUserId.trim();
        if (!id || isVerifying) {
            return;
        }
        setVerifyError('');
        setIsVerifying(true);
        try {
            const user = await vrchatFriendRepository.getUser({ userId: id });
            const verifiedId = typeof user.id === 'string' ? user.id : '';
            if (!verifiedId) {
                throw new Error('User response did not include an id.');
            }
            setVerifiedUser({
                id: verifiedId,
                displayName:
                    typeof user.displayName === 'string'
                        ? user.displayName
                        : verifiedId
            });
        } catch {
            setVerifiedUser(null);
            setVerifyError(t('view.charts.mutual_friend.tracked.verify_error'));
        } finally {
            setIsVerifying(false);
        }
    };

    const addTrackedUser = () => {
        if (!verifiedUser) {
            return;
        }
        onSetTrackedUser(verifiedUser.id, verifiedUser.displayName, true);
        setTrackedUserId('');
        setVerifiedUser(null);
        setVerifyError('');
    };

    return (
        <div className="flex flex-col gap-5">
            {mode === 'tracked' ? (
                <section className="flex flex-col gap-2">
                    <h3 className="text-muted-foreground text-xs font-medium tracking-wide">
                        {t('view.charts.mutual_friend.tracked.title')}
                    </h3>
                    <p className="text-muted-foreground text-xs">
                        {t('view.charts.mutual_friend.tracked.help')}
                    </p>
                    <div className="flex gap-2">
                        <Input
                            value={trackedUserId}
                            aria-label={t(
                                'view.charts.mutual_friend.tracked.user_id'
                            )}
                            placeholder={t(
                                'view.charts.mutual_friend.tracked.user_id'
                            )}
                            disabled={isVerifying}
                            onChange={(event) => {
                                setTrackedUserId(event.target.value);
                                setVerifiedUser(null);
                                setVerifyError('');
                            }}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    void verifyTrackedUser();
                                }
                            }}
                        />
                        {verifiedUser ? (
                            <Button
                                type="button"
                                size="sm"
                                onClick={addTrackedUser}
                            >
                                <UserPlusIcon data-icon="inline-start" />
                                {t('view.charts.mutual_friend.tracked.add')}
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={!trackedUserId.trim() || isVerifying}
                                onClick={() => void verifyTrackedUser()}
                            >
                                {isVerifying ? (
                                    <LoaderCircleIcon className="animate-spin" />
                                ) : (
                                    t(
                                        'view.charts.mutual_friend.tracked.verify'
                                    )
                                )}
                            </Button>
                        )}
                    </div>
                    {verifiedUser ? (
                        <p className="text-muted-foreground text-xs">
                            {t(
                                'view.charts.mutual_friend.tracked.verified_as',
                                { name: verifiedUser.displayName }
                            )}
                        </p>
                    ) : null}
                    {verifyError ? (
                        <p role="alert" className="text-destructive text-xs">
                            {verifyError}
                        </p>
                    ) : null}
                    {trackedUsers.length ? (
                        <ul className="flex flex-col gap-1">
                            {trackedUsers.map((user) => (
                                <li
                                    key={user.userId}
                                    className="bg-muted/30 flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5"
                                >
                                    <span className="min-w-0 flex-1 truncate text-xs">
                                        {user.displayName || user.userId}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label={t(
                                            'view.charts.mutual_friend.tracked.remove'
                                        )}
                                        onClick={() =>
                                            onSetTrackedUser(
                                                user.userId,
                                                user.displayName,
                                                false
                                            )
                                        }
                                    >
                                        <UserRoundMinusIcon />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-muted-foreground text-xs">
                            {t('view.charts.mutual_friend.tracked.empty')}
                        </p>
                    )}
                </section>
            ) : null}
            {mode === 'manual' ? (
                <section className="flex flex-col gap-2">
                    <h3 className="text-muted-foreground text-xs font-medium tracking-wide">
                        {t('view.charts.mutual_friend.manual.title')}
                    </h3>
                    <p className="text-muted-foreground text-xs">
                        {t('view.charts.mutual_friend.manual.help')}
                    </p>
                    <FriendMultiSelectList
                        options={options}
                        values={userA}
                        onChange={(values) => setUserA(values.slice(-1))}
                        placeholder={t(
                            'view.charts.mutual_friend.manual.user_a'
                        )}
                        emptyContent={t(
                            'view.charts.empty.no_friends_match_this_search'
                        )}
                        listClassName="bg-muted/30 max-h-40"
                    />
                    <FriendMultiSelectList
                        options={options}
                        values={userB}
                        onChange={(values) => setUserB(values.slice(-1))}
                        placeholder={t(
                            'view.charts.mutual_friend.manual.user_b'
                        )}
                        emptyContent={t(
                            'view.charts.empty.no_friends_match_this_search'
                        )}
                        listClassName="bg-muted/30 max-h-40"
                    />
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={
                            !userA[0] || !userB[0] || userA[0] === userB[0]
                        }
                        onClick={addRelation}
                    >
                        <Link2Icon data-icon="inline-start" />
                        {t('view.charts.mutual_friend.manual.add')}
                    </Button>
                    {manualLinks.length ? (
                        <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                            {manualLinks.map((link) => (
                                <li
                                    key={[link.userIdA, link.userIdB].join(
                                        '__'
                                    )}
                                    className="bg-muted/30 flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5"
                                >
                                    <span className="min-w-0 flex-1 truncate text-xs">
                                        {labelById.get(link.userIdA) ||
                                            link.userIdA}
                                        {' ↔ '}
                                        {labelById.get(link.userIdB) ||
                                            link.userIdB}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label={t(
                                            'view.charts.mutual_friend.manual.remove'
                                        )}
                                        onClick={() =>
                                            onSetManualLink(
                                                link.userIdA,
                                                link.userIdB,
                                                false
                                            )
                                        }
                                    >
                                        <Trash2Icon />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-muted-foreground text-xs">
                            {t('view.charts.mutual_friend.manual.empty')}
                        </p>
                    )}
                </section>
            ) : null}
        </div>
    );
}
