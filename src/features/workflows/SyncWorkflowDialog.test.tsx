// @vitest-environment jsdom
import {
    act,
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor
} from '@testing-library/react';
import type { ComponentProps, PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EnhancedInfoFetchSnapshot } from '@/services/enhancedInfoFetchService';

import { SyncWorkflowDialog } from './SyncWorkflowDialog';

const service = vi.hoisted(() => ({
    snapshot: {} as EnhancedInfoFetchSnapshot,
    listeners: new Set<(snapshot: EnhancedInfoFetchSnapshot) => void>(),
    run: vi.fn(),
    cancel: vi.fn()
}));
vi.mock('@/services/enhancedInfoFetchService', () => ({
    getEnhancedInfoFetchSnapshot: () => service.snapshot,
    subscribeEnhancedInfoFetch: (
        listener: (snapshot: EnhancedInfoFetchSnapshot) => void
    ) => {
        service.listeners.add(listener);
        return () => {
            service.listeners.delete(listener);
        };
    },
    runEnhancedInfoFetch: service.run,
    cancelEnhancedInfoFetch: service.cancel
}));
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, values?: Record<string, unknown>) =>
            values ? `${key} ${JSON.stringify(values)}` : key
    })
}));
vi.mock('@/ui/shadcn/dialog', () => ({
    Dialog: ({ open, children }: PropsWithChildren<{ open: boolean }>) =>
        open ? <div>{children}</div> : null,
    DialogContent: ({ children }: PropsWithChildren) => (
        <section>{children}</section>
    ),
    DialogHeader: ({ children }: PropsWithChildren) => (
        <header>{children}</header>
    ),
    DialogTitle: ({ children }: PropsWithChildren) => <h1>{children}</h1>,
    DialogDescription: ({ children }: PropsWithChildren) => <p>{children}</p>,
    DialogFooter: ({ children }: PropsWithChildren) => (
        <footer>{children}</footer>
    )
}));
vi.mock('@/ui/shadcn/button', () => ({
    Button: ({
        variant: _variant,
        ...props
    }: ComponentProps<'button'> & { variant?: string }) => <button {...props} />
}));
vi.mock('@/ui/shadcn/progress', () => ({
    Progress: (props: ComponentProps<'progress'>) => (
        <progress max={100} {...props} />
    )
}));
const props = {
    open: true,
    onOpenChange: vi.fn(),
    accountId: 'usr_current',
    accountLabel: 'Current'
};
function publish(patch: Partial<EnhancedInfoFetchSnapshot>) {
    act(() => {
        service.snapshot = { ...service.snapshot, ...patch };
        service.listeners.forEach((listener) => listener(service.snapshot));
    });
}
beforeEach(() => {
    vi.clearAllMocks();
    service.run.mockResolvedValue(undefined);
    service.snapshot = {
        accountId: 'usr_current',
        running: false,
        source: 'manual',
        phase: 'idle',
        currentTarget: null,
        total: 0,
        processed: 0,
        succeeded: 0,
        unchanged: 0,
        failed: 0,
        incomplete: 0,
        bioUpdated: 0,
        statusUpdated: 0,
        pauseReason: null,
        nextRunAt: null,
        errorMessage: null
    };
});
afterEach(() => {
    cleanup();
    service.listeners.clear();
});
describe('SyncWorkflowDialog enhanced fetching', () => {
    it('shows layered strategy and starts a manual service run', async () => {
        render(<SyncWorkflowDialog {...props} />);
        expect(
            screen.getByText('enhanced_info_fetch.strategy_auto')
        ).not.toBeNull();
        expect(
            screen.getByText('enhanced_info_fetch.strategy_profile')
        ).not.toBeNull();
        expect(
            screen.getByText('enhanced_info_fetch.strategy_manual')
        ).not.toBeNull();
        fireEvent.click(
            screen.getByRole('button', { name: 'enhanced_info_fetch.run' })
        );
        await waitFor(() => expect(service.run).toHaveBeenCalledWith('manual'));
    });
    it('uses real per-person counters and does not turn processed into success', () => {
        service.snapshot = {
            ...service.snapshot,
            running: true,
            phase: 'fetching',
            total: 10,
            processed: 8,
            succeeded: 3,
            unchanged: 2,
            failed: 4,
            incomplete: 1,
            bioUpdated: 2,
            statusUpdated: 1
        };
        render(<SyncWorkflowDialog {...props} />);
        expect(screen.getByTestId('count-succeeded').textContent).toBe('3');
        expect(screen.getByTestId('count-failed').textContent).toBe('4');
        expect(screen.getByTestId('count-incomplete').textContent).toBe('1');
        expect(screen.getByTestId('count-bioUpdated').textContent).toBe('2');
        expect(
            (screen.getByRole('progressbar') as HTMLProgressElement).value
        ).toBe(80);
    });
    it('continues on close, reopens with updated results, and cancels only explicitly', () => {
        service.snapshot = {
            ...service.snapshot,
            running: true,
            phase: 'fetching'
        };
        const view = render(<SyncWorkflowDialog {...props} />);
        fireEvent.click(
            screen.getByRole('button', { name: 'enhanced_info_fetch.close' })
        );
        expect(props.onOpenChange).toHaveBeenCalledWith(false);
        view.rerender(<SyncWorkflowDialog {...props} open={false} />);
        expect(service.cancel).not.toHaveBeenCalled();
        publish({
            processed: 5,
            succeeded: 4,
            total: 10,
            phase: 'relationships'
        });
        view.rerender(<SyncWorkflowDialog {...props} />);
        expect(screen.getByTestId('count-succeeded').textContent).toBe('4');
        expect(
            screen.getByText('enhanced_info_fetch.phase.relationships')
        ).not.toBeNull();
        fireEvent.click(
            screen.getByRole('button', { name: 'enhanced_info_fetch.cancel' })
        );
        expect(service.cancel).toHaveBeenCalledTimes(1);
        view.unmount();
        expect(service.listeners.size).toBe(0);
        expect(service.cancel).toHaveBeenCalledTimes(1);
    });
    it('hides previous-account results and prevents running without an account', () => {
        service.snapshot = {
            ...service.snapshot,
            accountId: 'usr_previous',
            succeeded: 9,
            currentTarget: {
                userId: 'usr_secret',
                displayName: 'Previous target'
            }
        };
        const view = render(<SyncWorkflowDialog {...props} />);
        expect(screen.getByTestId('count-succeeded').textContent).toBe('0');
        expect(screen.queryByText(/Previous target/)).toBeNull();
        view.rerender(<SyncWorkflowDialog {...props} accountId="" />);
        expect(
            (
                screen.getByRole('button', {
                    name: 'enhanced_info_fetch.run'
                }) as HTMLButtonElement
            ).disabled
        ).toBe(true);
    });
    it('shows pause, next retry and errors without fabricating completion', () => {
        service.snapshot = {
            ...service.snapshot,
            running: true,
            phase: 'paused',
            processed: 2,
            total: 10,
            pauseReason: '429',
            nextRunAt: '2026-10-02T12:00:00Z',
            errorMessage: 'network'
        };
        render(<SyncWorkflowDialog {...props} />);
        expect(
            screen.getByText('enhanced_info_fetch.phase.paused')
        ).not.toBeNull();
        expect(
            screen.getByText(/enhanced_info_fetch.pause_reason/).textContent
        ).toContain('429');
        expect(
            screen.getByText(/enhanced_info_fetch.next_run /)
        ).not.toBeNull();
        expect(screen.getByRole('alert').textContent).toContain('network');
        expect(
            (screen.getByRole('progressbar') as HTMLProgressElement).value
        ).toBe(20);
        publish({ running: false, phase: 'completed' });
        expect(
            screen.getByText('enhanced_info_fetch.phase.completed')
        ).not.toBeNull();
        expect(screen.getByTestId('count-succeeded').textContent).toBe('0');
    });
    it('reports rejected manual requests', async () => {
        service.run.mockRejectedValueOnce(new Error('failed'));
        render(<SyncWorkflowDialog {...props} />);
        fireEvent.click(
            screen.getByRole('button', { name: 'enhanced_info_fetch.run' })
        );
        expect((await screen.findByRole('alert')).textContent).toBe(
            'enhanced_info_fetch.request_error'
        );
    });
});
