import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useRuntimeStore } from '@/state/runtimeStore';
import { Button } from '@/ui/shadcn/button';

import {
    calculateRelationshipRecommendations,
    confirmRelationshipRecommendation,
    ignoreRelationshipRecommendation,
    useRelationshipRecommendations
} from './relationshipRecommendationsService';

export function RelationshipRecommendationsPanel() {
    const { t } = useTranslation();
    const accountId =
        useRuntimeStore((state) => state.auth.currentUserId) || '';
    const state = useRelationshipRecommendations(
        (state) => state.accounts[accountId]
    );
    const [actionError, setActionError] = useState('');
    const [pending, setPending] = useState('');
    const action = async (key: string, work: () => Promise<void>) => {
        setPending(key);
        setActionError('');
        try {
            await work();
        } catch (error) {
            setActionError(
                error instanceof Error ? error.message : String(error)
            );
        } finally {
            setPending('');
        }
    };
    const rows = (state?.suggestions || []).filter(
        (row) => !state?.ignored.has(row.key)
    );
    return (
        <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">
                {t('jirai.relationship_recommendations.title', {
                    defaultValue: '或许是好友'
                })}
            </h3>
            <p className="text-muted-foreground text-xs">
                {t('jirai.relationship_recommendations.local_only', {
                    defaultValue:
                        '仅根据本地记录计算，不抓取完整关系网。分数是推测证据，并非好友确认。'
                })}
            </p>
            <Button
                size="sm"
                variant="outline"
                disabled={!accountId || state?.computing || !!pending}
                onClick={() =>
                    void action('compute', () =>
                        calculateRelationshipRecommendations({
                            accountId,
                            signal: new AbortController().signal
                        })
                    )
                }
            >
                {state?.computing
                    ? t('jirai.relationship_recommendations.computing', {
                          defaultValue: '计算中…'
                      })
                    : t('jirai.relationship_recommendations.compute', {
                          defaultValue: '计算建议'
                      })}
            </Button>
            {state?.computing && state.progress ? (
                <p className="text-xs">
                    {state.progress.step} {state.progress.done}/
                    {state.progress.total}
                </p>
            ) : null}
            {state?.error || actionError ? (
                <p role="alert" className="text-destructive text-xs">
                    {actionError || state?.error}
                </p>
            ) : null}
            <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
                {rows.map((row) => (
                    <li key={row.key} className="rounded border p-2 text-xs">
                        <div className="flex items-center gap-2">
                            <span className="flex-1">
                                {row.nameA} ↔ {row.nameB}
                            </span>
                            <span>{row.displayScore}</span>
                            {row.isAdded ? (
                                <span>
                                    {t(
                                        'jirai.relationship_recommendations.confirmed',
                                        { defaultValue: '已确认' }
                                    )}
                                </span>
                            ) : (
                                <>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={!!pending}
                                        onClick={() =>
                                            void action(row.key, async () => {
                                                await confirmRelationshipRecommendation(
                                                    accountId,
                                                    row
                                                );
                                            })
                                        }
                                    >
                                        {t(
                                            'jirai.relationship_recommendations.confirm',
                                            { defaultValue: '确认' }
                                        )}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        disabled={!!pending}
                                        onClick={() =>
                                            void action(row.key, () =>
                                                ignoreRelationshipRecommendation(
                                                    accountId,
                                                    row.key
                                                )
                                            )
                                        }
                                    >
                                        {t(
                                            'jirai.relationship_recommendations.ignore',
                                            { defaultValue: '本次忽略' }
                                        )}
                                    </Button>
                                </>
                            )}
                        </div>
                        <details className="mt-1">
                            <summary>
                                {t(
                                    'jirai.relationship_recommendations.evidence',
                                    { defaultValue: '证据与分数' }
                                )}
                            </summary>
                            <p className="mt-1 whitespace-pre-wrap">
                                {row.tooltip}
                            </p>
                        </details>
                    </li>
                ))}
            </ul>
        </section>
    );
}
