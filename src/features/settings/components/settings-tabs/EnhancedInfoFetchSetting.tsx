import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import configRepository from '@/repositories/configRepository';
import { Switch } from '@/ui/shadcn/switch';

import { SettingsCard } from '../SettingsCard';
import { Field } from '../SettingsField';

export function EnhancedInfoFetchSetting() {
    const { t } = useTranslation();
    const [enabled, setEnabled] = useState(true);
    const [ready, setReady] = useState(false);
    const [saving, setSaving] = useState(false);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        let active = true;
        void configRepository
            .getBool('enhancedInfoFetchEnabled')
            .then((value) => {
                if (active) {
                    setEnabled(value);
                    setReady(true);
                }
            })
            .catch(() => {
                if (active) setFailed(true);
            });
        return () => {
            active = false;
        };
    }, []);
    async function change(value: boolean) {
        setSaving(true);
        setFailed(false);
        try {
            await configRepository.setBool('enhancedInfoFetchEnabled', value);
            setEnabled(value);
        } catch {
            setFailed(true);
        } finally {
            setSaving(false);
        }
    }
    return (
        <SettingsCard
            cardId="social.enhanced-info-fetch"
            title={t('view.tools.system_tools.info_completion')}
        >
            <Field
                label={t('enhanced_info_fetch.setting_label')}
                description={t('enhanced_info_fetch.setting_description')}
            >
                <Switch
                    aria-label={t('enhanced_info_fetch.setting_label')}
                    checked={enabled}
                    disabled={!ready || saving}
                    onCheckedChange={(value) => void change(value)}
                />
            </Field>
            {failed ? (
                <p role="alert">{t('enhanced_info_fetch.setting_error')}</p>
            ) : null}
        </SettingsCard>
    );
}
