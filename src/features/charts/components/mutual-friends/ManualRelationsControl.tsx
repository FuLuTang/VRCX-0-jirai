import { Link2Icon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';

import type { ManualRelation } from '@/repositories/manualRelationsRepository';
import { Button } from '@/ui/shadcn/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/ui/shadcn/dialog';
import { Input } from '@/ui/shadcn/input';

export function ManualRelationsControl({
    ownerUserId,
    relations,
    labelsById,
    isLoading,
    error,
    onAdd,
    onRemove
}: {
    ownerUserId: string;
    relations: ManualRelation[];
    labelsById: Readonly<Record<string, string>>;
    isLoading: boolean;
    error: string;
    onAdd: (userIdA: string, userIdB: string) => Promise<void>;
    onRemove: (userIdA: string, userIdB: string) => Promise<void>;
}) {
    const [open, setOpen] = useState(false);
    const [userIdA, setUserIdA] = useState('');
    const [userIdB, setUserIdB] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [actionError, setActionError] = useState('');
    const normalizedUserIdA = userIdA.trim();
    const normalizedUserIdB = userIdB.trim();
    const canAdd =
        Boolean(ownerUserId) &&
        Boolean(normalizedUserIdA) &&
        Boolean(normalizedUserIdB) &&
        normalizedUserIdA !== normalizedUserIdB &&
        !isSaving;

    async function addRelation() {
        if (!canAdd) {
            return;
        }
        setActionError('');
        setIsSaving(true);
        try {
            await onAdd(normalizedUserIdA, normalizedUserIdB);
            setUserIdA('');
            setUserIdB('');
        } catch (nextError) {
            setActionError(
                nextError instanceof Error
                    ? nextError.message
                    : 'Unable to add manual relationship.'
            );
        } finally {
            setIsSaving(false);
        }
    }

    async function removeRelation(relation: ManualRelation) {
        setActionError('');
        setIsSaving(true);
        try {
            await onRemove(relation.userIdA, relation.userIdB);
        } catch (nextError) {
            setActionError(
                nextError instanceof Error
                    ? nextError.message
                    : 'Unable to remove manual relationship.'
            );
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Manage manual relationships"
                title="Manage manual relationships"
                disabled={!ownerUserId}
                onClick={() => setOpen(true)}
            >
                <Link2Icon />
            </Button>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Manual relationships</DialogTitle>
                    <DialogDescription>
                        Add green overlay connections without changing fetched
                        mutual-friend data.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <Input
                        aria-label="First user id"
                        value={userIdA}
                        disabled={isSaving}
                        placeholder="First user ID"
                        onChange={(event) => setUserIdA(event.target.value)}
                    />
                    <Input
                        aria-label="Second user id"
                        value={userIdB}
                        disabled={isSaving}
                        placeholder="Second user ID"
                        onChange={(event) => setUserIdB(event.target.value)}
                    />
                    <Button
                        type="button"
                        disabled={!canAdd}
                        onClick={addRelation}
                    >
                        Add
                    </Button>
                </div>
                {normalizedUserIdA &&
                normalizedUserIdA === normalizedUserIdB ? (
                    <p className="text-destructive text-xs">
                        Choose two different user IDs.
                    </p>
                ) : null}
                {actionError || error ? (
                    <p className="text-destructive text-xs">
                        {actionError || error}
                    </p>
                ) : null}

                <div className="max-h-72 overflow-y-auto">
                    {isLoading ? (
                        <p className="text-muted-foreground py-4 text-sm">
                            Loading manual relationships…
                        </p>
                    ) : relations.length ? (
                        <ul className="flex flex-col gap-2">
                            {relations.map((relation) => (
                                <li
                                    key={`${relation.userIdA}__${relation.userIdB}`}
                                    className="flex items-center gap-2 rounded-lg border p-2"
                                >
                                    <span className="min-w-0 flex-1 truncate text-sm">
                                        {labelsById[relation.userIdA] ||
                                            relation.userIdA}{' '}
                                        <span aria-hidden="true">↔</span>{' '}
                                        {labelsById[relation.userIdB] ||
                                            relation.userIdB}
                                    </span>
                                    <Button
                                        type="button"
                                        size="icon-xs"
                                        variant="destructive"
                                        aria-label={`Remove relationship between ${relation.userIdA} and ${relation.userIdB}`}
                                        disabled={isSaving}
                                        onClick={() => removeRelation(relation)}
                                    >
                                        <Trash2Icon />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-muted-foreground py-4 text-sm">
                            No manual relationships yet.
                        </p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
