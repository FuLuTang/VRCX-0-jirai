// @vitest-environment jsdom
import {
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
    within
} from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    RelationshipUserPicker,
    type RelationshipUserOption
} from './RelationshipUserPicker';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, values?: Record<string, string>) =>
            key === 'view.charts.two_person_relationship.use_id'
                ? 'Use this ID: ' + values?.id
                : key
    })
}));

afterEach(cleanup);

const options: RelationshipUserOption[] = [
    { id: 'usr_11111111-1111-1111-1111-111111111111', label: 'Sora' },
    { id: 'usr_22222222-2222-2222-2222-222222222222', label: 'Mika' },
    { id: 'usr_33333333-3333-3333-3333-333333333333', label: 'Sumi' }
];

function renderPicker(excludeUserId = '') {
    const onValueChange = vi.fn();
    function ControlledPicker() {
        const [value, setValue] = useState('');
        return (
            <RelationshipUserPicker
                value={value}
                options={options}
                excludeUserId={excludeUserId}
                placeholder="Select person"
                onValueChange={(next) => {
                    onValueChange(next);
                    setValue(next);
                }}
            />
        );
    }

    render(<ControlledPicker />);
    return {
        onValueChange,
        input: screen.getByRole('combobox') as HTMLInputElement
    };
}

describe('RelationshipUserPicker', () => {
    it('filters to display names containing the typed text', async () => {
        const { input } = renderPicker();
        fireEvent.click(input);
        fireEvent.change(input, { target: { value: 'S' } });

        await waitFor(() => {
            const list = screen.getByRole('listbox');
            expect(within(list).getByText('Sora')).toBeTruthy();
            expect(within(list).getByText('Sumi')).toBeTruthy();
            expect(within(list).queryByText('Mika')).toBeNull();
        });
    });

    it('matches an ID fragment independent of display name', async () => {
        const { input } = renderPicker();
        fireEvent.click(input);
        fireEvent.change(input, { target: { value: '22222222' } });

        await waitFor(() => {
            const list = screen.getByRole('listbox');
            expect(within(list).getByText('Mika')).toBeTruthy();
            expect(within(list).queryByText('Sora')).toBeNull();
        });
    });

    it('offers and selects an unlisted complete user ID', async () => {
        const { input, onValueChange } = renderPicker();
        const id = 'usr_abcdef12-3456-7890-abcd-ef1234567890';
        fireEvent.click(input);
        fireEvent.change(input, { target: { value: id } });

        const option = await screen.findByText('Use this ID: ' + id);
        fireEvent.click(option);

        await waitFor(() => expect(onValueChange).toHaveBeenCalledWith(id));
        expect(input.value).toBe(id);
    });

    it('excludes the person selected on the other side', async () => {
        const { input } = renderPicker(options[0].id);
        fireEvent.click(input);
        fireEvent.change(input, { target: { value: 'S' } });

        await waitFor(() => {
            const list = screen.getByRole('listbox');
            expect(within(list).queryByText('Sora')).toBeNull();
            expect(within(list).getByText('Sumi')).toBeTruthy();
        });
    });
});
