// @vitest-environment jsdom
import {
    act,
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
    within
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
const controls = vi.hoisted(() => ({
    enabled: true,
    getBool: vi.fn(),
    jobs: [] as import('@/platform/tauri/bindings').RuntimeBackgroundJobSnapshot[],
    relationships: undefined as
        | undefined
        | {
              progress: { done: number; total: number; step: string };
              suggestions: unknown[];
          }
}));
vi.mock('@/repositories/configRepository', () => ({
    default: { getBool: controls.getBool }
}));
vi.mock('./useEnhancedFetchSchedule', () => ({
    useEnhancedFetchSchedule: () => ({ jobs: controls.jobs, error: false })
}));
vi.mock(
    '@/features/charts/relationship-recommendations/relationshipRecommendationsService',
    () => ({
        useRelationshipRecommendations: (
            selector: (state: unknown) => unknown
        ) => selector({ accounts: { usr_current: controls.relationships } })
    })
);
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
    controls.enabled = true;
    controls.getBool.mockImplementation(async () => controls.enabled);
    controls.jobs = [];
    controls.relationships = undefined;
    service.run.mockResolvedValue(undefined);
    service.snapshot = {
        accountId: 'usr_current',
        running: false,
        source: 'manual',
        phase: 'idle',
        collectionStatus: 'idle',
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
        errorMessage: null,
        friendsTotal: 7,
        trackedTotal: 3,
        relationshipStatus: 'waiting',
        relationshipError: null
    };
});
afterEach(() => {
    cleanup();
    service.listeners.clear();
});
describe('SyncWorkflowDialog parallel periodic refresh', () => {
    it('shows one refresh flow, two parallel task progress bars and six result cells', () => {
        render(<SyncWorkflowDialog {...props} />);
        expect(screen.getAllByRole('progressbar')).toHaveLength(2);
        expect(screen.getByTestId('hourly-tasks').className).toContain(
            'sm:grid-cols-2'
        );
        expect(
            within(screen.getByTestId('hourly-tasks')).getAllByRole(
                'progressbar'
            )
        ).toHaveLength(2);
        expect(screen.getByTestId('result-grid').className).toContain(
            'sm:grid-cols-6'
        );
        expect(
            within(screen.getByTestId('result-grid')).getAllByRole('definition')
        ).toHaveLength(6);
        expect(screen.queryByTestId('flow-startup')).toBeNull();
        expect(screen.queryByTestId('trigger-grid')).toBeNull();
        expect(
            screen.queryByTestId('schedule-backgroundCurrentUserRefresh')
        ).toBeNull();
        expect(screen.getByTestId('roster-counts').textContent).toContain(
            '"friends":7'
        );
        expect(screen.getByTestId('roster-counts').textContent).toContain(
            '"tracked":3'
        );
    });
    it('shows independent task progress during parallel collection and relationship computation', () => {
        service.snapshot = {
            ...service.snapshot,
            running: true,
            phase: 'fetching',
            collectionStatus: 'running',
            total: 10,
            processed: 8,
            succeeded: 3,
            failed: 4,
            incomplete: 1,
            bioUpdated: 2,
            relationshipStatus: 'running'
        };
        controls.relationships = {
            progress: { done: 4, total: 10, step: 'real-computation' },
            suggestions: []
        };
        render(<SyncWorkflowDialog {...props} />);
        expect(
            (
                screen.getByRole('progressbar', {
                    name: 'enhanced_info_fetch.progress'
                }) as HTMLProgressElement
            ).value
        ).toBe(80);
        expect(screen.getByTestId('relationship-progress').textContent).toBe(
            '40%'
        );
        expect(screen.getByText(/real-computation/)).not.toBeNull();
        expect(screen.getByTestId('count-succeeded').textContent).toBe('3');
        expect(screen.getByTestId('count-failed').textContent).toBe('4');
        expect(screen.getByTestId('count-incomplete').textContent).toBe('1');
        expect(screen.getByTestId('count-bioUpdated').textContent).toBe('2');
    });
    it('keeps relationship progress visible after profile collection completes', () => {
        service.snapshot = {
            ...service.snapshot,
            running: true,
            phase: 'relationships',
            collectionStatus: 'completed',
            total: 10,
            processed: 10,
            relationshipStatus: 'running'
        };
        controls.relationships = {
            progress: { done: 4, total: 10, step: 'local-history' },
            suggestions: []
        };
        render(<SyncWorkflowDialog {...props} />);
        expect(
            (
                screen.getByRole('progressbar', {
                    name: 'enhanced_info_fetch.progress'
                }) as HTMLProgressElement
            ).value
        ).toBe(100);
        expect(
            within(screen.getByTestId('task-collection')).getByText(
                'enhanced_info_fetch.collection_status.completed'
            )
        ).not.toBeNull();
        expect(screen.getByTestId('relationship-progress').textContent).toBe(
            '40%'
        );
    });
    it('does not call an unavailable relationship engine successful', () => {
        service.snapshot = {
            ...service.snapshot,
            phase: 'completed',
            collectionStatus: 'completed',
            total: 10,
            processed: 10,
            relationshipStatus: 'unavailable'
        };
        controls.relationships = {
            progress: { done: 10, total: 10, step: 'stale' },
            suggestions: []
        };
        render(<SyncWorkflowDialog {...props} />);
        expect(
            (
                screen.getByRole('progressbar', {
                    name: 'enhanced_info_fetch.progress'
                }) as HTMLProgressElement
            ).value
        ).toBe(100);
        expect(
            screen.getByText('enhanced_info_fetch.hourly_status.partial')
        ).not.toBeNull();
        expect(
            screen.getByText(
                'enhanced_info_fetch.relationship_status.unavailable'
            )
        ).not.toBeNull();
        expect(screen.getByTestId('relationship-progress').textContent).toBe(
            '0%'
        );
        expect(screen.queryByText(/stale/)).toBeNull();
    });
    it('updates native hourly countdown locally and ignores non-enhanced native jobs', async () => {
        vi.useFakeTimers();
        try {
            controls.jobs = [
                {
                    name: 'backgroundSocialBaselineRefresh',
                    owner: 'native',
                    cadenceSeconds: 3600,
                    nextRunAt: new Date(Date.now() + 125_000).toISOString(),
                    lastStartedAt: null,
                    lastFinishedAt: null,
                    lastDetail: '',
                    lastError: null,
                    failureCount: 2,
                    status: 'scheduled'
                },
                {
                    name: 'backgroundCurrentUserRefresh',
                    owner: 'native',
                    cadenceSeconds: 300,
                    nextRunAt: null,
                    lastStartedAt: null,
                    lastFinishedAt: null,
                    lastDetail: 'unrelated job',
                    lastError: null,
                    failureCount: 0,
                    status: 'scheduled'
                }
            ];
            render(<SyncWorkflowDialog {...props} />);
            await act(async () => {
                await Promise.resolve();
            });
            expect(screen.getByTestId('flow-hourly').textContent).toContain(
                '00:02:05'
            );
            await act(async () => {
                await vi.advanceTimersByTimeAsync(1000);
            });
            expect(screen.getByTestId('flow-hourly').textContent).toContain(
                '00:02:04'
            );
            expect(screen.getByTestId('flow-hourly').textContent).toContain(
                '"seconds":3600'
            );
            expect(screen.queryByText('unrelated job')).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });
    it('hides automatic hourly countdowns while disabled but permits immediate refresh', async () => {
        controls.enabled = false;
        render(<SyncWorkflowDialog {...props} />);
        await waitFor(() =>
            expect(screen.getByTestId('flow-hourly').textContent).toContain(
                'enhanced_info_fetch.hourly_disabled'
            )
        );
        expect(screen.getByTestId('flow-hourly').textContent).not.toContain(
            'enhanced_info_fetch.scheduled'
        );
        expect(
            (
                screen.getByRole('button', {
                    name: 'enhanced_info_fetch.run'
                }) as HTMLButtonElement
            ).disabled
        ).toBe(false);
    });
    it('starts the single periodic refresh without a separate source argument', async () => {
        render(<SyncWorkflowDialog {...props} />);
        fireEvent.click(
            screen.getByRole('button', { name: 'enhanced_info_fetch.run' })
        );
        await waitFor(() => expect(service.run).toHaveBeenCalledWith());
    });
    it('continues on close and reopens refresh results without implicit cancellation', () => {
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
        publish({
            processed: 5,
            succeeded: 4,
            total: 10,
            relationshipStatus: 'completed'
        });
        view.rerender(<SyncWorkflowDialog {...props} />);
        expect(screen.getByTestId('count-succeeded').textContent).toBe('4');
        expect(service.cancel).not.toHaveBeenCalled();
        fireEvent.click(
            screen.getByRole('button', { name: 'enhanced_info_fetch.cancel' })
        );
        expect(service.cancel).toHaveBeenCalledTimes(1);
        view.unmount();
        expect(service.listeners.size).toBe(0);
        expect(service.cancel).toHaveBeenCalledTimes(1);
    });
    it('overrides internal running states on overall cancellation', () => {
        service.snapshot = {
            ...service.snapshot,
            phase: 'cancelled',
            collectionStatus: 'cancelled',
            running: true,
            total: 10,
            processed: 2,
            relationshipStatus: 'running'
        };
        render(<SyncWorkflowDialog {...props} />);
        expect(
            screen.getByText('enhanced_info_fetch.collection_status.cancelled')
        ).not.toBeNull();
        expect(
            screen.getByText(
                'enhanced_info_fetch.relationship_status.cancelled'
            )
        ).not.toBeNull();
        expect(
            screen.queryByRole('button', { name: 'enhanced_info_fetch.cancel' })
        ).toBeNull();
    });
    it('hides refresh results from previous accounts and prevents refresh without an account', () => {
        service.snapshot = {
            ...service.snapshot,
            accountId: 'usr_previous',
            succeeded: 9,
            relationshipError: 'previous error',
            currentTarget: {
                userId: 'usr_secret',
                displayName: 'Previous target'
            }
        };
        const view = render(<SyncWorkflowDialog {...props} />);
        expect(screen.getByTestId('count-succeeded').textContent).toBe('0');
        expect(screen.queryByText(/previous|Previous/)).toBeNull();
        view.rerender(<SyncWorkflowDialog {...props} accountId="" />);
        expect(
            (
                screen.getByRole('button', {
                    name: 'enhanced_info_fetch.run'
                }) as HTMLButtonElement
            ).disabled
        ).toBe(true);
    });
    it('shows relationship errors separately from collection results', () => {
        service.snapshot = {
            ...service.snapshot,
            phase: 'error',
            collectionStatus: 'completed',
            total: 10,
            processed: 10,
            relationshipStatus: 'error',
            relationshipError: 'local suggestions failed',
            errorMessage: 'hourly failure'
        };
        render(<SyncWorkflowDialog {...props} />);
        expect(screen.getByTestId('task-relationships').textContent).toContain(
            'enhanced_info_fetch.relationship_status.error'
        );
        expect(
            screen
                .getAllByRole('alert')
                .map((node) => node.textContent)
                .join(' ')
        ).toContain('local suggestions failed');
        expect(screen.getByTestId('task-collection').textContent).toContain(
            'enhanced_info_fetch.collection_status.completed'
        );
        expect(
            (
                screen.getByRole('progressbar', {
                    name: 'enhanced_info_fetch.progress'
                }) as HTMLProgressElement
            ).value
        ).toBe(100);
    });
    it('shows completed empty collection even if the independent recommendation task failed', () => {
        service.snapshot = {
            ...service.snapshot,
            phase: 'error',
            collectionStatus: 'completed',
            relationshipStatus: 'error',
            relationshipError: 'history unavailable'
        };
        render(<SyncWorkflowDialog {...props} />);
        expect(
            within(screen.getByTestId('task-collection')).getByText(
                'enhanced_info_fetch.collection_status.completed'
            )
        ).not.toBeNull();
        expect(
            (
                screen.getByRole('progressbar', {
                    name: 'enhanced_info_fetch.progress'
                }) as HTMLProgressElement
            ).value
        ).toBe(100);
    });
    it('does not infer collection success from the processed count after storage failure', () => {
        service.snapshot = {
            ...service.snapshot,
            phase: 'error',
            collectionStatus: 'error',
            total: 10,
            processed: 10
        };
        render(<SyncWorkflowDialog {...props} />);
        expect(
            within(screen.getByTestId('task-collection')).getByText(
                'enhanced_info_fetch.collection_status.error'
            )
        ).not.toBeNull();
        expect(
            within(screen.getByTestId('task-collection')).queryByText(
                'enhanced_info_fetch.collection_status.completed'
            )
        ).toBeNull();
    });
    it('shows retry state without treating processed people as successful', () => {
        service.snapshot = {
            ...service.snapshot,
            running: true,
            phase: 'paused',
            collectionStatus: 'paused',
            total: 10,
            processed: 2,
            pauseReason: '429',
            nextRunAt: '2026-10-03T12:00:00Z',
            errorMessage: 'network'
        };
        render(<SyncWorkflowDialog {...props} />);
        expect(
            screen.getByText('enhanced_info_fetch.hourly_status.paused')
        ).not.toBeNull();
        expect(
            screen.getByText(/enhanced_info_fetch.pause_reason/).textContent
        ).toContain('429');
        expect(
            screen.getByText(/enhanced_info_fetch.next_run /)
        ).not.toBeNull();
        expect(screen.getByRole('alert').textContent).toContain('network');
        expect(
            (
                screen.getByRole('progressbar', {
                    name: 'enhanced_info_fetch.progress'
                }) as HTMLProgressElement
            ).value
        ).toBe(20);
        expect(screen.getByTestId('count-succeeded').textContent).toBe('0');
    });
    it('reports rejected refresh requests', async () => {
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
