import { describe, expect, it } from 'vitest';

import type { FeedRowOutput } from '@/platform/tauri/bindings';

import { buildInlineBioDiff, groupBioHistoryRows } from './bioHistory';

function bioRow(
    created_at: string,
    previousBio: string | null,
    bio: string | null
): FeedRowOutput {
    return { type: 'Bio', created_at, previousBio, bio };
}

describe('groupBioHistoryRows', () => {
    it('merges a burst of edits within 24 hours into one net change', () => {
        const groups = groupBioHistoryRows([
            bioRow('2026-01-01T12:00:00Z', 'Draft', 'Final'),
            bioRow('2026-01-01T01:00:00Z', 'Original', 'Draft')
        ]);

        expect(groups).toHaveLength(1);
        expect(groups[0]).toMatchObject({
            previousBio: 'Original',
            bio: 'Final',
            count: 2
        });
        expect(groups[0].earliest.created_at).toBe('2026-01-01T01:00:00Z');
        expect(groups[0].latest.created_at).toBe('2026-01-01T12:00:00Z');
    });

    it('includes edits exactly 24 hours apart and separates a longer gap', () => {
        const groups = groupBioHistoryRows([
            bioRow('2026-01-04T00:00:01Z', 'C', 'D'),
            bioRow('2026-01-03T00:00:00Z', 'B', 'C'),
            bioRow('2026-01-02T00:00:00Z', 'A', 'B')
        ]);

        expect(groups).toHaveLength(2);
        expect(groups[0]).toMatchObject({
            previousBio: 'C',
            bio: 'D',
            count: 1
        });
        expect(groups[1]).toMatchObject({
            previousBio: 'A',
            bio: 'C',
            count: 2
        });
    });

    it('keeps blank Bios as valid values and orders groups newest first', () => {
        const groups = groupBioHistoryRows([
            bioRow('2026-01-03T00:00:00Z', 'Text', ''),
            bioRow('2026-01-01T00:00:00Z', '', 'Text')
        ]);

        expect(groups).toHaveLength(2);
        expect(
            groups.map(({ previousBio, bio }) => [previousBio, bio])
        ).toEqual([
            ['Text', ''],
            ['', 'Text']
        ]);
    });
});

describe('buildInlineBioDiff', () => {
    it('highlights changed CJK text inline while preserving surrounding text', () => {
        expect(
            buildInlineBioDiff(
                '你好，目前在国内实习。',
                '你好，喜欢安静的地方。'
            )
        ).toEqual([
            { type: 'equal', text: '你好，' },
            { type: 'remove', text: '目前在国内实习' },
            { type: 'add', text: '喜欢安静的地方' },
            { type: 'equal', text: '。' }
        ]);
    });

    it('treats an empty Bio as a deletion or addition', () => {
        expect(buildInlineBioDiff('Old bio', '')).toEqual([
            { type: 'remove', text: 'Old bio' }
        ]);
        expect(buildInlineBioDiff('', 'New bio')).toEqual([
            { type: 'add', text: 'New bio' }
        ]);
    });
});
