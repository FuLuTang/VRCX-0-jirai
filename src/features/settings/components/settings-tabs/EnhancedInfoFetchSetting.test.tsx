// @vitest-environment jsdom
import {
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor
} from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EnhancedInfoFetchSetting } from './EnhancedInfoFetchSetting';
const config = vi.hoisted(() => ({ getBool: vi.fn(), setBool: vi.fn() }));
vi.mock('@/repositories/configRepository', () => ({ default: config }));
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../SettingsCard', () => ({
    SettingsCard: ({ children }: PropsWithChildren) => (
        <section>{children}</section>
    )
}));
vi.mock('../SettingsField', () => ({
    Field: ({ children }: PropsWithChildren) => <div>{children}</div>
}));
vi.mock('@/ui/shadcn/switch', () => ({
    Switch: ({
        checked,
        disabled,
        onCheckedChange
    }: {
        checked: boolean;
        disabled: boolean;
        onCheckedChange: (value: boolean) => void;
    }) => (
        <input
            type="checkbox"
            role="switch"
            aria-checked={checked}
            checked={checked}
            disabled={disabled}
            onChange={(event) => onCheckedChange(event.target.checked)}
        />
    )
}));
beforeEach(() => {
    vi.clearAllMocks();
    config.getBool.mockResolvedValue(true);
    config.setBool.mockResolvedValue(undefined);
});
afterEach(cleanup);
describe('EnhancedInfoFetchSetting', () => {
    it('reads the schema-backed independent preference and writes only its key', async () => {
        render(<EnhancedInfoFetchSetting />);
        const toggle = screen.getByRole('switch') as HTMLInputElement;
        await waitFor(() => expect(toggle.disabled).toBe(false));
        expect(config.getBool).toHaveBeenCalledWith('enhancedInfoFetchEnabled');
        expect(toggle.checked).toBe(true);
        fireEvent.click(toggle);
        await waitFor(() => expect(toggle.checked).toBe(false));
        expect(config.setBool).toHaveBeenCalledExactlyOnceWith(
            'enhancedInfoFetchEnabled',
            false
        );
    });
    it('retains the saved false value on mounting', async () => {
        config.getBool.mockResolvedValueOnce(false);
        render(<EnhancedInfoFetchSetting />);
        const toggle = screen.getByRole('switch') as HTMLInputElement;
        await waitFor(() => expect(toggle.disabled).toBe(false));
        expect(toggle.checked).toBe(false);
        expect(config.setBool).not.toHaveBeenCalled();
    });
    it('keeps the previous value and reports failed saves', async () => {
        config.setBool.mockRejectedValueOnce(new Error('write failed'));
        render(<EnhancedInfoFetchSetting />);
        const toggle = screen.getByRole('switch') as HTMLInputElement;
        await waitFor(() => expect(toggle.disabled).toBe(false));
        fireEvent.click(toggle);
        expect((await screen.findByRole('alert')).textContent).toBe(
            'enhanced_info_fetch.setting_error'
        );
        expect(toggle.checked).toBe(true);
    });
});
