import React, { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('@/ui/shadcn/tooltip', () => ({
    Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
    TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
    TooltipTrigger: ({ render }: { render: ReactNode }) => <>{render}</>
}));
vi.mock('./CommitSlider', () => ({ CommitSlider: () => null }));
vi.mock('./MutualFriendsSurface', () => ({
    MutualFriendsSurface: ({ children }: { children: ReactNode }) => (
        <div>{children}</div>
    )
}));

import { MutualFriendsLegend } from './MutualFriendsLegend';

describe('MutualFriendsLegend', () => {
    it('exposes a green, labelled manual-relationship legend item', () => {
        const markup = renderToStaticMarkup(
            React.createElement(MutualFriendsLegend, {
                communities: [],
                coverage: {
                    friendCount: 0,
                    fetchedCount: 0,
                    unavailableCount: 0,
                    lastFetchedAt: null
                },
                crossCommunityOnly: false,
                focusedCommunity: null,
                isolatedCounts: { noConnections: 0, unavailable: 0 },
                minDegree: 0,
                onMinDegreeChange: () => undefined,
                onToggleCrossCommunityOnly: () => undefined,
                onToggleFocusedCommunity: () => undefined,
                unknownCount: 0
            })
        );

        expect(markup).toContain('aria-label="Manual relationship edge"');
        expect(markup).toContain('Manual relationship');
        expect(markup).toContain('bg-green-600');
    });
});
