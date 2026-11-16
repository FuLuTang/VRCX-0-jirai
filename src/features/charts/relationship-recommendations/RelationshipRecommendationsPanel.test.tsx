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
    calculate: vi.fn(async () => {}),
    openUserDialog: vi.fn(),
    recommendationState: undefined as unknown
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
vi.mock('@/services/dialogService', () => ({
    openUserDialog: mocks.openUserDialog
}));
vi.mock('./relationshipRecommendationsService', () => ({
    calculateRelationshipRecommendations: mocks.calculate,
    confirmRelationshipRecommendation: vi.fn(),
    ignoreRelationshipRecommendation: vi.fn(),
    useRelationshipRecommendations: (
        selector: (state: { accounts: Record<string, unknown> }) => unknown
    ) =>
        selector({
            accounts: mocks.accountId
                ? { [mocks.accountId]: mocks.recommendationState }
                : {}
        })
}));
import { RelationshipRecommendationsPanel } from './RelationshipRecommendationsPanel';
beforeEach(() => {
    mocks.accountId = null;
    mocks.recommendationState = undefined;
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
    it('opens each recommended player in the shared user dialog', () => {
        mocks.accountId = 'me';
        mocks.recommendationState = {
            suggestions: [
                {
                    key: 'user-a:user-b',
                    userIdA: 'usr_a',
                    userIdB: 'usr_b',
                    nameA: 'Player A',
                    nameB: 'Player B',
                    score: 10,
                    displayScore: '10',
                    tooltip: 'shared history',
                    isAdded: false
                }
            ],
            ignored: new Set<string>(),
            computing: false,
            error: '',
            progress: null
        };

        render(<RelationshipRecommendationsPanel />);
        fireEvent.click(screen.getByRole('button', { name: 'Player A' }));
        fireEvent.click(screen.getByRole('button', { name: 'Player B' }));

        expect(mocks.openUserDialog).toHaveBeenNthCalledWith(1, {
            userId: 'usr_a'
        });
        expect(mocks.openUserDialog).toHaveBeenNthCalledWith(2, {
            userId: 'usr_b'
        });
    });
});
