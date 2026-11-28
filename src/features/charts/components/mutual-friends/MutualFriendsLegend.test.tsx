// @vitest-environment jsdom
import React, { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('@/lib/dateTime', () => ({
    formatDateFilter: () => 'date'
}));
vi.mock('@/ui/shadcn/tooltip', () => ({
    Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
    TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
    TooltipTrigger: ({ render }: { render: ReactNode }) => <>{render}</>
}));
vi.mock('@/components/mutual-friends/CommitSlider', () => ({
    CommitSlider: () => null
}));
vi.mock('./MutualFriendsSurface', () => ({
    MutualFriendsSurface: ({ children }: { children: ReactNode }) => (
        <div>{children}</div>
    )
}));

import { MutualFriendsLegend } from './MutualFriendsLegend';

function renderLegend(overrides: Record<string, unknown> = {}) {
    return renderToStaticMarkup(
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
            isDarkMode: false,
            minDegree: 0,
            onMinDegreeChange: () => undefined,
            onToggleCrossCommunityOnly: () => undefined,
            onToggleFocusedCommunity: () => undefined,
            unknownCount: 0,
            ...overrides
        })
    );
}

describe('MutualFriendsLegend', () => {
    it('exposes a green, labelled manual-relationship legend item', () => {
        const markup = renderLegend();

        expect(markup).toContain(
            'view.charts.mutual_friend.legend.edge_manual'
        );
        expect(markup).toContain(
            'view.charts.mutual_friend.legend.edge_label_manual'
        );
        expect(markup).toContain('#15803d');
    });

    it('lists named circles and hides the hollow unknown hint at zero', () => {
        const markup = renderLegend({
            communities: [
                {
                    index: 0,
                    size: 7,
                    color: '#ff0000',
                    label: 'Circle A',
                    isNamed: true
                }
            ]
        });

        expect(markup).toContain('Circle A');
        expect(markup).toContain('#ff0000');
        expect(markup).not.toContain(
            'view.charts.mutual_friend.legend.hollow_means_unknown'
        );
    });

    it('reflects the cross-community toggle state', () => {
        const markup = renderLegend({ crossCommunityOnly: true });

        expect(markup).toContain('aria-pressed="true"');
        expect(markup).toContain(
            'view.charts.mutual_friend.legend.cross_edges'
        );
    });

    it('shows the hollow unknown hint when unknown nodes exist', () => {
        const markup = renderLegend({ unknownCount: 3 });

        expect(markup).toContain(
            'view.charts.mutual_friend.legend.hollow_means_unknown'
        );
    });
});
