import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useRuntimeStore } from '@/state/runtimeStore';
import { useTrackedNonfriendsStore } from '@/state/trackedNonfriendsStore';
import { Button } from '@/ui/shadcn/button';
import { Input } from '@/ui/shadcn/input';

export function TrackedNonfriendsSidebar({
    filterQuery = ''
}: {
    filterQuery?: string;
}) {
    const { t } = useTranslation();
    const accountId = useRuntimeStore(
        (state) => state.auth.currentUserId || ''
    );
    const currentUserId = useTrackedNonfriendsStore(
        (state) => state.currentUserId
    );
    const entries = useTrackedNonfriendsStore((state) => state.entries);
    const loadStatus = useTrackedNonfriendsStore((state) => state.loadStatus);
    const error = useTrackedNonfriendsStore((state) => state.error);
    const load = useTrackedNonfriendsStore((state) => state.load);
    const reset = useTrackedNonfriendsStore((state) => state.reset);
    const add = useTrackedNonfriendsStore((state) => state.add);
    const remove = useTrackedNonfriendsStore((state) => state.remove);
    const [userId, setUserId] = useState('');

    useEffect(() => {
        if (accountId) {
            void load(accountId);
        } else {
            reset();
        }
    }, [accountId, load, reset]);

    const query = filterQuery.trim().toLowerCase();
    const visibleEntries =
        currentUserId === accountId && accountId
            ? entries.filter((entry) =>
                  !query
                      ? true
                      : `${entry.displayName} ${entry.userId}`
                            .toLowerCase()
                            .includes(query)
              )
            : [];

    async function addEntry() {
        const normalizedUserId = userId.trim();
        if (!accountId || !normalizedUserId) {
            return;
        }
        if (await add(accountId, normalizedUserId)) {
            setUserId('');
        }
    }

    return (
        <section className="flex h-full min-h-0 flex-col gap-2 px-1 pb-1">
            <div className="flex gap-1">
                <Input
                    value={userId}
                    placeholder="usr_…"
                    aria-label={t('tracked_nonfriends.add_user')}
                    onChange={(event) => setUserId(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            void addEntry();
                        }
                    }}
                />
                <Button
                    size="icon"
                    aria-label={t('tracked_nonfriends.add_user')}
                    disabled={!accountId || !userId.trim()}
                    onClick={() => void addEntry()}
                >
                    <PlusIcon />
                </Button>
            </div>
            {loadStatus === 'loading' ? (
                <p className="text-muted-foreground px-2 text-sm">
                    {t('common.loading')}
                </p>
            ) : null}
            {loadStatus === 'error' ? (
                <p className="text-destructive px-2 text-sm" role="alert">
                    {error || t('tracked_nonfriends.load_error')}
                </p>
            ) : null}
            {loadStatus === 'ready' && !visibleEntries.length ? (
                <p className="text-muted-foreground px-2 text-sm">
                    {t('tracked_nonfriends.empty')}
                </p>
            ) : null}
            <div className="min-h-0 flex-1 overflow-y-auto">
                {visibleEntries.map((entry) => (
                    <div
                        key={entry.userId}
                        className="hover:bg-accent flex items-center gap-2 rounded px-2 py-1.5"
                    >
                        <span className="min-w-0 flex-1 truncate text-sm">
                            {entry.displayName || entry.userId}
                        </span>
                        <Button
                            size="icon-xs"
                            variant="ghost"
                            aria-label={t('tracked_nonfriends.remove_user')}
                            onClick={() => void remove(accountId, entry.userId)}
                        >
                            <Trash2Icon />
                        </Button>
                    </div>
                ))}
            </div>
        </section>
    );
}
