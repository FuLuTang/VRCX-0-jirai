import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';
import { XIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export type RelationshipUserOption = {
    id: string;
    label: string;
    tracked?: boolean;
};

const USER_ID_PATTERN = /^usr_[a-z0-9_-]{4,}$/i;
const OPTION_LIMIT = 50;

function matchesRelationshipUserOption(
    option: RelationshipUserOption,
    query: string
) {
    const search = query.trim().toLocaleLowerCase();
    if (!search) return true;

    const normalizedId = option.id.toLocaleLowerCase();
    const searchableId = search.startsWith('usr_')
        ? normalizedId
        : normalizedId.replace(/^usr_/, '');
    return (
        option.label.toLocaleLowerCase().includes(search) ||
        searchableId.includes(search)
    );
}

export function filterRelationshipUserOptions(
    options: RelationshipUserOption[],
    query: string,
    excludedUserId = ''
) {
    return options
        .filter((option) => option.id !== excludedUserId)
        .filter((option) => matchesRelationshipUserOption(option, query))
        .slice(0, OPTION_LIMIT);
}

export function RelationshipUserPicker({
    value,
    options,
    excludeUserId = '',
    placeholder,
    onValueChange
}: {
    value: string;
    options: RelationshipUserOption[];
    excludeUserId?: string;
    placeholder: string;
    onValueChange: (userId: string) => void;
}) {
    const { t } = useTranslation();
    const selectedOption = useMemo(
        () =>
            options.find((option) => option.id === value) ??
            (value ? { id: value, label: value } : null),
        [options, value]
    );
    const [inputValue, setInputValue] = useState(selectedOption?.label ?? '');
    const [open, setOpen] = useState(false);

    useEffect(() => {
        setInputValue(selectedOption?.label ?? '');
    }, [selectedOption?.id, selectedOption?.label]);

    const search = inputValue.trim();
    const availableOptions = useMemo(
        () =>
            options
                .filter((option) => option.id !== excludeUserId)
                .slice(0, OPTION_LIMIT),
        [excludeUserId, options]
    );
    const directIdOption =
        USER_ID_PATTERN.test(search) &&
        !options.some(
            (option) => option.id.toLowerCase() === search.toLowerCase()
        ) &&
        search.toLowerCase() !== excludeUserId.toLowerCase()
            ? { id: search, label: search, direct: true }
            : null;
    const items = directIdOption
        ? [directIdOption, ...availableOptions]
        : availableOptions;
    const displayedValue = selectedOption
        ? (options.find((option) => option.id === selectedOption.id) ??
          selectedOption)
        : null;

    return (
        <ComboboxPrimitive.Root
            items={items}
            filter={matchesRelationshipUserOption}
            autoHighlight
            open={open}
            onOpenChange={setOpen}
            value={displayedValue}
            inputValue={inputValue}
            onInputValueChange={(next) => {
                setInputValue(next);
                setOpen(true);
            }}
            onValueChange={(next) => {
                if (next) {
                    onValueChange(next.id);
                    setInputValue(next.label);
                    setOpen(false);
                }
            }}
            isItemEqualToValue={(option, selected) => option.id === selected.id}
        >
            <div className="relative min-w-0">
                <ComboboxPrimitive.Input
                    aria-label={placeholder}
                    placeholder={placeholder}
                    className="border-input bg-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 pr-9 text-sm outline-none focus-visible:ring-2"
                />
                {value ? (
                    <button
                        type="button"
                        aria-label={t('common.actions.clear')}
                        className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded p-1"
                        onClick={() => {
                            onValueChange('');
                            setInputValue('');
                        }}
                    >
                        <XIcon className="size-4" />
                    </button>
                ) : null}
                <ComboboxPrimitive.Portal>
                    <ComboboxPrimitive.Positioner
                        sideOffset={4}
                        className="z-50"
                    >
                        <ComboboxPrimitive.Popup className="bg-popover text-popover-foreground ring-foreground/10 w-(--anchor-width) overflow-hidden rounded-md shadow-md ring-1">
                            <ComboboxPrimitive.List className="max-h-72 overflow-y-auto p-1">
                                {(
                                    option: RelationshipUserOption & {
                                        direct?: boolean;
                                    }
                                ) => (
                                    <ComboboxPrimitive.Item
                                        key={option.id}
                                        value={option}
                                        className="data-highlighted:bg-accent data-highlighted:text-accent-foreground flex cursor-pointer items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm outline-none"
                                    >
                                        <span className="truncate">
                                            {option.direct
                                                ? t(
                                                      'view.charts.two_person_relationship.use_id',
                                                      { id: option.id }
                                                  )
                                                : option.label}
                                        </span>
                                        {option.tracked ? (
                                            <span className="text-muted-foreground shrink-0 text-xs">
                                                {t(
                                                    'view.charts.two_person_relationship.tracked'
                                                )}
                                            </span>
                                        ) : null}
                                    </ComboboxPrimitive.Item>
                                )}
                            </ComboboxPrimitive.List>
                            <ComboboxPrimitive.Empty className="text-muted-foreground px-3 py-2 text-sm">
                                {t(
                                    'view.charts.two_person_relationship.no_matches'
                                )}
                            </ComboboxPrimitive.Empty>
                        </ComboboxPrimitive.Popup>
                    </ComboboxPrimitive.Positioner>
                </ComboboxPrimitive.Portal>
            </div>
        </ComboboxPrimitive.Root>
    );
}
