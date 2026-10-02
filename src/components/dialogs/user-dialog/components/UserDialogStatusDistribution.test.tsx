// @vitest-environment jsdom
import {
    act,
    cleanup,
    fireEvent,
    render,
    renderHook,
    screen
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    UserDialogStatusDistribution,
    useStatusDistributionScale
} from './UserDialogStatusDistribution';

const mocks = vi.hoisted(() => ({
    query: vi.fn(),
    option: vi.fn(),
    dispose: vi.fn(),
    owner: 'usr_owner',
    theme: 'light'
}));
vi.mock('./statusDistributionQuery', () => ({
    queryStatusDistributionHistory: mocks.query
}));
vi.mock('@/lib/echarts', () => ({
    echarts: {
        init: () => ({
            setOption: mocks.option,
            resize: vi.fn(),
            dispose: mocks.dispose
        })
    }
}));
vi.mock('@/state/runtimeStore', () => ({
    useRuntimeStore: (selector: (state: unknown) => unknown) =>
        selector({ auth: { currentUserId: mocks.owner } })
}));
vi.mock('@/state/shellStore', () => ({
    useShellStore: Object.assign(
        (selector: (state: unknown) => unknown) =>
            selector({ themeMode: mocks.theme }),
        {
            getState: () => ({
                timeUnitLabels: {
                    day: 'd',
                    hour: 'h',
                    minute: 'm',
                    second: 's'
                }
            })
        }
    )
}));
vi.mock('@/services/themeService', () => ({
    useResolvedThemeMode: () => mocks.theme
}));
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));
vi.stubGlobal(
    'ResizeObserver',
    class {
        observe() {}
        disconnect() {}
    }
);

const history = [
    {
        userId: 'usr_target',
        type: 'Status',
        status: 'active',
        created_at: '2026-01-01T00:00:00Z'
    },
    {
        userId: 'usr_target',
        type: 'Online',
        created_at: '2026-01-01T00:00:00Z'
    },
    {
        userId: 'usr_target',
        type: 'Offline',
        created_at: '2026-01-03T00:00:00Z'
    }
];
afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
    mocks.owner = 'usr_owner';
    mocks.theme = 'light';
});

describe('status distribution component', () => {
    it('resets the one-second debounce on every movement and cancels it on unmount', () => {
        vi.useFakeTimers();
        const { result, unmount } = renderHook(useStatusDistributionScale);
        act(() => result.current.setSlider(0));
        expect(result.current.bucketDays).toBe(1);
        expect(result.current.committedBucketDays).toBe(10);
        act(() => vi.advanceTimersByTime(900));
        act(() => result.current.setSlider(100));
        act(() => vi.advanceTimersByTime(999));
        expect(result.current.bucketDays).toBe(90);
        expect(result.current.committedBucketDays).toBe(10);
        act(() => vi.advanceTimersByTime(1));
        expect(result.current.committedBucketDays).toBe(90);
        act(() => result.current.setSlider(0));
        unmount();
        expect(vi.getTimerCount()).toBe(0);
    });
    it('requests self data but never extends an open self session from profile state', async () => {
        mocks.query.mockResolvedValue(
            history
                .slice(0, 2)
                .map((entry) => ({ ...entry, userId: 'usr_owner' }))
        );
        render(
            <UserDialogStatusDistribution
                profile={{ id: 'usr_owner', state: 'online' }}
            />
        );
        await act(async () => fireEvent.click(screen.getByRole('button')));
        expect(mocks.query).toHaveBeenCalledWith(
            'usr_owner',
            'usr_owner',
            expect.any(Function)
        );
        expect(
            screen.getByText(
                'dialog.user.status_distribution.insufficient_self_samples'
            )
        ).toBeTruthy();
        expect(screen.queryByRole('img')).toBeNull();
    });
    it('renders stacked time percentages and duration tooltip; dragging never queries', async () => {
        vi.useFakeTimers();
        mocks.query.mockResolvedValue(history);
        render(
            <UserDialogStatusDistribution
                profile={{ id: 'usr_target', state: 'offline' }}
            />
        );
        await act(async () => fireEvent.click(screen.getByRole('button')));
        expect(mocks.query).toHaveBeenCalledTimes(1);
        const initial = mocks.option.mock.calls.at(-1)![0];
        expect(initial.series).toHaveLength(4);
        expect(
            initial.series.every(
                (s: { type: string; stack: string }) =>
                    s.type === 'line' && s.stack === 'total'
            )
        ).toBe(true);
        expect(initial.series.map((s: { color: string }) => s.color)).toEqual([
            '#00B8FF',
            '#2ED319',
            '#E97C03',
            '#C80928'
        ]);
        expect(initial.tooltip.formatter([{ dataIndex: 0 }])).toContain(
            '100.0%'
        );
        expect(initial.tooltip.formatter([{ dataIndex: 0 }])).toContain('UTC');
        mocks.option.mockClear();
        fireEvent.change(screen.getByRole('slider'), {
            target: { value: '0' }
        });
        expect(mocks.option).not.toHaveBeenCalled();
        act(() => vi.advanceTimersByTime(999));
        expect(mocks.option).not.toHaveBeenCalled();
        act(() => vi.advanceTimersByTime(1));
        expect(mocks.option.mock.calls.at(-1)![0].xAxis.data).toEqual([
            '2026-01-01',
            '2026-01-02'
        ]);
        expect(mocks.query).toHaveBeenCalledTimes(1);
    });
    it('ignores stale results after changing target and unmounting', async () => {
        let resolve!: (rows: typeof history) => void;
        mocks.query.mockReturnValue(
            new Promise((done) => {
                resolve = done;
            })
        );
        const { rerender, unmount } = render(
            <UserDialogStatusDistribution profile={{ id: 'usr_target' }} />
        );
        fireEvent.click(screen.getByRole('button'));
        rerender(
            <UserDialogStatusDistribution profile={{ id: 'usr_other' }} />
        );
        await act(async () => resolve(history));
        expect(screen.queryByRole('img')).toBeNull();
        unmount();
    });
    it('shows a friendly empty state with no chart for zero confirmed samples', async () => {
        mocks.query.mockResolvedValue(history.slice(0, 1));
        render(<UserDialogStatusDistribution profile={{ id: 'usr_target' }} />);
        await act(async () => fireEvent.click(screen.getByRole('button')));
        expect(
            screen.getByText('dialog.user.info.no_status_distribution')
        ).toBeTruthy();
        expect(screen.queryByRole('img')).toBeNull();
    });
    it('counts closed self sessions and refreshes/disposes the chart on theme changes', async () => {
        mocks.query.mockResolvedValue(
            history.map((entry) => ({ ...entry, userId: 'usr_owner' }))
        );
        const { rerender, unmount } = render(
            <UserDialogStatusDistribution profile={{ id: 'usr_owner' }} />
        );
        await act(async () => fireEvent.click(screen.getByRole('button')));
        expect(screen.getByRole('img')).toBeTruthy();
        expect(
            screen.getByText('dialog.user.status_distribution.self_scope')
        ).toBeTruthy();
        expect(mocks.option.mock.calls.at(-1)![0].yAxis.axisLabel.color).toBe(
            '#555'
        );
        mocks.theme = 'dark';
        rerender(
            <UserDialogStatusDistribution profile={{ id: 'usr_owner' }} />
        );
        expect(mocks.dispose).toHaveBeenCalledTimes(1);
        expect(mocks.option.mock.calls.at(-1)![0].yAxis.axisLabel.color).toBe(
            '#bbb'
        );
        unmount();
        expect(mocks.dispose).toHaveBeenCalledTimes(2);
    });
});
