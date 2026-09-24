// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import vrchatInstanceRepository from '@/repositories/vrchatInstanceRepository';

import { useFriendsLocationsInstancePopulation } from './useFriendsLocationsInstancePopulation';

vi.mock('@/repositories/vrchatInstanceRepository', () => ({
    default: { getInstance: vi.fn() }
}));

function Harness({
    enabled,
    friendCount
}: {
    enabled: boolean;
    friendCount: number;
}) {
    const { ref, population } = useFriendsLocationsInstancePopulation({
        worldId: 'wrld_a',
        instanceId: '12345~friends(usr_a)',
        enabled,
        friendCount
    });
    return (
        <div ref={ref} data-testid="population">
            {population
                ? `${population.nUsers}/${population.capacity}`
                : 'none'}
        </div>
    );
}

beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(vrchatInstanceRepository.getInstance).mockResolvedValue({
        json: { n_users: 12, capacity: 32 }
    } as Awaited<ReturnType<typeof vrchatInstanceRepository.getInstance>>);
});

afterEach(() => {
    cleanup();
});

describe('useFriendsLocationsInstancePopulation', () => {
    it('loads the instance population once the row is shown', async () => {
        render(<Harness enabled friendCount={1} />);

        await waitFor(() => {
            expect(screen.getByTestId('population').textContent).toBe('12/32');
        });
        expect(vrchatInstanceRepository.getInstance).toHaveBeenCalledWith({
            worldId: 'wrld_a',
            instanceId: '12345~friends(usr_a)'
        });
    });

    it('refetches when the friend count in the instance changes', async () => {
        const { rerender } = render(<Harness enabled friendCount={1} />);
        await waitFor(() => {
            expect(vrchatInstanceRepository.getInstance).toHaveBeenCalledTimes(
                1
            );
        });

        rerender(<Harness enabled friendCount={2} />);

        await waitFor(() => {
            expect(vrchatInstanceRepository.getInstance).toHaveBeenCalledTimes(
                2
            );
        });
    });

    it('does not request locations that are not real instances', () => {
        render(<Harness enabled={false} friendCount={1} />);

        expect(vrchatInstanceRepository.getInstance).not.toHaveBeenCalled();
        expect(screen.getByTestId('population').textContent).toBe('none');
    });
});
