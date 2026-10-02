// @vitest-environment jsdom
import {
    act,
    cleanup,
    fireEvent,
    render,
    screen
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EnhancedInfoFetchSnapshot } from '@/services/enhancedInfoFetchService';

import { EnhancedInfoFetchStatus } from './EnhancedInfoFetchStatus';

const state = vi.hoisted(() => ({
    snapshot: {} as EnhancedInfoFetchSnapshot,
    listeners: new Set<(snapshot: EnhancedInfoFetchSnapshot) => void>(),
    open: vi.fn(),
    accountId: 'usr_current'
}));
vi.mock('@/services/enhancedInfoFetchService', () => ({
    getEnhancedInfoFetchSnapshot: () => state.snapshot,
    subscribeEnhancedInfoFetch: (
        listener: (snapshot: EnhancedInfoFetchSnapshot) => void
    ) => {
        state.listeners.add(listener);
        return () => {
            state.listeners.delete(listener);
        };
    }
}));
vi.mock('@/state/runtimeStore', () => ({
    useRuntimeStore: (select: (value: unknown) => unknown) =>
        select({
            auth: { currentUserId: state.accountId },
            setSystemHostOpen: state.open
        })
}));
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, values?: Record<string, unknown>) =>
            values ? `${key} ${JSON.stringify(values)}` : key
    })
}));
vi.mock('./StatusBarParts', () => ({
    StatusSegment: ({
        label,
        value,
        tooltip,
        onClick,
        warn
    }: {
        label: string;
        value: string;
        tooltip: string;
        onClick: () => void;
        warn: boolean;
    }) => (
        <button onClick={onClick} title={tooltip} data-warn={warn}>
            {label} {value}
        </button>
    )
}));
beforeEach(() => {
    vi.clearAllMocks();
    state.accountId = 'usr_current';
    state.snapshot = {
        accountId: 'usr_current',
        running: true,
        phase: 'fetching',
        source: 'manual',
        total: 10,
        processed: 7,
        succeeded: 3,
        failed: 2,
        incomplete: 1,
        unchanged: 2,
        bioUpdated: 1,
        statusUpdated: 1,
        pauseReason: null,
        nextRunAt: null,
        errorMessage: null,
        currentTarget: null
    };
});
afterEach(() => {
    cleanup();
    state.listeners.clear();
});
describe('EnhancedInfoFetchStatus', () => {
    it('reopens details rather than starting or cancelling a run', () => {
        render(<EnhancedInfoFetchStatus />);
        const button = screen.getByRole('button');
        expect(button.textContent).toContain('7/10');
        expect(button.title).toContain('"succeeded":3');
        expect(button.title).toContain('"failed":2');
        fireEvent.click(button);
        expect(state.open).toHaveBeenCalledWith('syncWorkflowOpen', true);
    });
    it('remains available after completion and updates subscribed counters', () => {
        const view = render(<EnhancedInfoFetchStatus />);
        act(() => {
            state.snapshot = {
                ...state.snapshot,
                running: false,
                phase: 'completed',
                processed: 10
            };
            state.listeners.forEach((listener) => listener(state.snapshot));
        });
        expect(screen.getByRole('button').textContent).toContain('10/10');
        expect(screen.getByRole('button').title).toContain(
            'enhanced_info_fetch.phase.completed'
        );
        view.unmount();
        expect(state.listeners.size).toBe(0);
    });
    it('hides stale counts after switching accounts', () => {
        state.accountId = 'usr_other';
        render(<EnhancedInfoFetchStatus />);
        const button = screen.getByRole('button');
        expect(button.textContent).toContain('enhanced_info_fetch.phase.idle');
        expect(button.textContent).not.toContain('7/10');
        expect(button.title).toContain('"succeeded":0');
        expect(button.getAttribute('data-warn')).toBe('false');
    });
});
