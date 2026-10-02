// @vitest-environment jsdom
import {
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
    accountId: null as string | null,
    calculate: vi.fn(async () => {})
}));
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { defaultValue?: string }) =>
            options?.defaultValue || key
    })
}));
vi.mock('@/state/runtimeStore', () => ({
    useRuntimeStore: (
        selector: (state: { auth: { currentUserId: string | null } }) => unknown
    ) => selector({ auth: { currentUserId: mocks.accountId } })
}));
vi.mock('./relationshipRecommendationsService', () => ({
    calculateRelationshipRecommendations: mocks.calculate,
    confirmRelationshipRecommendation: vi.fn(),
    ignoreRelationshipRecommendation: vi.fn(),
    useRelationshipRecommendations: (
        selector: (state: { accounts: Record<string, never> }) => unknown
    ) => selector({ accounts: {} })
}));
import { RelationshipRecommendationsPanel } from './RelationshipRecommendationsPanel';
beforeEach(() => {
    mocks.accountId = null;
    vi.clearAllMocks();
});
afterEach(cleanup);
describe('recommendation panel account guard', () => {
    it('renders safely with no active account and cannot calculate', () => {
        render(<RelationshipRecommendationsPanel />);
        const button = screen.getByRole('button', { name: '计算建议' });
        expect((button as HTMLButtonElement).disabled).toBe(true);
        fireEvent.click(button);
        expect(mocks.calculate).not.toHaveBeenCalled();
    });
    it('uses the same local executor for the manual compute entry', async () => {
        mocks.accountId = 'me';
        render(<RelationshipRecommendationsPanel />);
        fireEvent.click(screen.getByRole('button', { name: '计算建议' }));
        await waitFor(() =>
            expect(mocks.calculate).toHaveBeenCalledWith({
                accountId: 'me',
                signal: expect.any(AbortSignal)
            })
        );
    });
});
