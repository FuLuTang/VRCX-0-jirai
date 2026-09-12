// @ts-nocheck
import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';

import { Spinner } from '@/ui/shadcn/spinner';

const RelationshipTimelinePageImpl = lazy(() =>
    import('./RelationshipTimelinePageImpl').then((module) => ({
        default: module.RelationshipTimelinePage
    }))
);

function ChartPageFallback() {
    const { t } = useTranslation();

    return (
        <div className="text-muted-foreground flex h-full min-h-0 items-center justify-center gap-2 text-sm">
            <Spinner className="size-4" />
            <span>{t('common.loading')}</span>
        </div>
    );
}

export function RelationshipTimelinePage(props) {
    return (
        <Suspense fallback={<ChartPageFallback />}>
            <RelationshipTimelinePageImpl {...props} />
        </Suspense>
    );
}
