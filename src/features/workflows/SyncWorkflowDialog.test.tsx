// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps, PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SyncWorkflowAction } from './syncWorkflow';
import { SyncWorkflowDialog } from './SyncWorkflowDialog';

const translations: Record<string, string> = {
    'workflow.title': 'Account sync workflow',
    'workflow.description': 'Tasks run for the current account: {{account}}.',
    'workflow.action_list': 'Synchronization tasks',
    'workflow.ready': 'Ready to run a new workflow.',
    'workflow.account_unavailable': 'No current account',
    'workflow.run': 'Run workflow',
    'workflow.running': 'Workflow running',
    'workflow.cancel_current': 'Cancel current task',
    'workflow.progress_bar': 'Workflow progress',
    'workflow.skip_reason': 'Skip reason',
    'workflow.skip.account_required':
        'A current account is required before this workflow can run.',
    'workflow.skip.cancelled_by_user': 'Cancelled by user.',
    'workflow.skip.cancelled_before_execution': 'Cancelled before execution.',
    'workflow.actions.startup_online_backfill': '05 · Startup online backfill',
    'workflow.actions.tracked_non_friends_sync': '06 · Tracked non-friends',
    'workflow.actions.manual_relations_sync': '07 · Manual relationships',
    'workflow.actions.automatic_profile_fetch': '08 · Automatic profile fetch',
    'workflow.actions.relationship_recommendations':
        '09 · Relationship recommendations',
    'workflow.status.completed': 'Completed',
    'workflow.status.skipped': 'Skipped',
    'workflow.status.error': 'Error',
    'workflow.status.running': 'Running',
    'workflow.status.pending': 'Pending'
};

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, values?: Record<string, string | number>) => {
            if (key === 'workflow.summary') {
                return `Progress ${values?.progress}/${values?.total} · Completed ${values?.completed} · Skipped ${values?.skipped} · Errors ${values?.error} · Running ${values?.running}`;
            }
            return (translations[key] ?? key).replace(
                '{{account}}',
                String(values?.account ?? '')
            );
        }
    })
}));

vi.mock('@/ui/shadcn/badge', () => ({
    Badge: ({
        children,
        ...props
    }: PropsWithChildren<ComponentProps<'span'>>) => (
        <span {...props}>{children}</span>
    )
}));
vi.mock('@/ui/shadcn/button', () => ({
    Button: ({
        children,
        ...props
    }: PropsWithChildren<ComponentProps<'button'>>) => (
        <button {...props}>{children}</button>
    )
}));
vi.mock('@/ui/shadcn/dialog', () => ({
    Dialog: ({ children, open }: PropsWithChildren<{ open: boolean }>) =>
        open ? <div>{children}</div> : null,
    DialogContent: ({ children }: PropsWithChildren) => (
        <section>{children}</section>
    ),
    DialogDescription: ({ children }: PropsWithChildren) => <p>{children}</p>,
    DialogFooter: ({ children }: PropsWithChildren) => (
        <footer>{children}</footer>
    ),
    DialogHeader: ({ children }: PropsWithChildren) => (
        <header>{children}</header>
    ),
    DialogTitle: ({ children }: PropsWithChildren) => <h1>{children}</h1>
}));
vi.mock('@/ui/shadcn/progress', () => ({
    Progress: (props: ComponentProps<'progress'>) => <progress {...props} />
}));

afterEach(cleanup);

function cancellableAction(): SyncWorkflowAction {
    return {
        id: 'startup-online-backfill',
        label: '05 · Startup online backfill',
        status: 'pending',
        cancel: vi.fn(),
        run: ({ signal }) =>
            new Promise((_, reject) => {
                signal.addEventListener('abort', () =>
                    reject(new DOMException('Cancelled', 'AbortError'))
                );
            })
    };
}

describe('SyncWorkflowDialog', () => {
    it('lists the stable pending action catalog before the first run', () => {
        render(
            <SyncWorkflowDialog
                open
                onOpenChange={() => {}}
                accountId="usr_current"
                accountLabel="Current user"
            />
        );

        expect(screen.getByText('05 · Startup online backfill')).not.toBeNull();
        expect(screen.getByText('06 · Tracked non-friends')).not.toBeNull();
        expect(screen.getByText('07 · Manual relationships')).not.toBeNull();
        expect(screen.getByText('08 · Automatic profile fetch')).not.toBeNull();
        expect(
            screen.getByText('09 · Relationship recommendations')
        ).not.toBeNull();
        expect(screen.getAllByRole('status', { name: 'Pending' })).toHaveLength(
            5
        );
        expect(
            screen.getByText(
                'Progress 0/5 · Completed 0 · Skipped 0 · Errors 0 · Running 0'
            )
        ).not.toBeNull();
    });

    it('disables running without a current account and explains the skip reason', () => {
        render(
            <SyncWorkflowDialog
                open
                onOpenChange={() => {}}
                accountId=""
                accountLabel=""
            />
        );

        expect(
            (
                screen.getByRole('button', {
                    name: 'Run workflow'
                }) as HTMLButtonElement
            ).disabled
        ).toBe(true);
        expect(
            screen.getByText(
                (_content, element) =>
                    element?.textContent ===
                    'Skip reason: A current account is required before this workflow can run.'
            )
        ).not.toBeNull();
    });

    it('announces accessible running status and cancellation skip reason', async () => {
        render(
            <SyncWorkflowDialog
                open
                onOpenChange={() => {}}
                accountId="usr_current"
                accountLabel="Current user"
                actionsFactory={() => [cancellableAction()]}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Run workflow' }));
        expect(
            (await screen.findByRole('status', { name: 'Running' })).textContent
        ).toBe('Running');
        expect(
            screen.getByRole('progressbar', { name: 'Workflow progress' })
        ).not.toBeNull();

        fireEvent.click(
            screen.getByRole('button', { name: 'Cancel current task' })
        );
        expect(
            await screen.findByText(
                (_content, element) =>
                    element?.textContent === 'Skip reason: Cancelled by user.'
            )
        ).not.toBeNull();
        expect(
            screen.getByRole('status', { name: 'Skipped' }).textContent
        ).toBe('Skipped');
    });
});
