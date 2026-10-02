import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import configRepository from '@/repositories/configRepository';
import { Switch } from '@/ui/shadcn/switch';

export function RelationshipRecommendationNotificationSetting() {
    const { t } = useTranslation();
    const [enabled, setEnabled] = useState(true);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        let active = true;
        void configRepository
            .getBool('relationshipRecommendationOverlayEnabled', true)
            .then((value) => {
                if (active) {
                    setEnabled(value);
                    setReady(true);
                }
            })
            .catch((error) => {
                if (active) setError(String(error));
            });
        return () => {
            active = false;
        };
    }, []);
    return (
        <div className="flex flex-col gap-2 rounded-lg border p-4">
            <label className="flex items-center justify-between gap-4">
                <span>
                    {t('jirai.relationship_recommendations.overlay_setting', {
                        defaultValue: '进房时提醒「或许是好友」'
                    })}
                </span>
                <Switch
                    checked={enabled}
                    disabled={!ready}
                    onCheckedChange={(value) => {
                        setReady(false);
                        setError('');
                        void configRepository
                            .setBool(
                                'relationshipRecommendationOverlayEnabled',
                                value
                            )
                            .then(() => setEnabled(value))
                            .catch((error) => setError(String(error)))
                            .finally(() => setReady(true));
                    }}
                />
            </label>
            <p className="text-muted-foreground text-xs">
                {t('jirai.relationship_recommendations.overlay_help', {
                    defaultValue:
                        '仅真实进入实例且双方同时在场时显示。连续同房只提醒一次，离开后再次同房可重触发。'
                })}
            </p>
            {error ? (
                <p role="alert" className="text-destructive text-xs">
                    {error}
                </p>
            ) : null}
        </div>
    );
}
