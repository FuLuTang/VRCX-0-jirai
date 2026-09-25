import type { FeedRowOutput } from '@/platform/tauri/bindings';

const BIO_CHANGE_MERGE_WINDOW_MS = 24 * 60 * 60 * 1000;

export type BioHistoryGroup = {
    /** Newest record in this change group. */
    latest: FeedRowOutput;
    /** Oldest record in this change group. */
    earliest: FeedRowOutput;
    /** Bio before the first change in this group. */
    previousBio: string;
    /** Bio after the last change in this group. */
    bio: string;
    count: number;
};

export type BioInlineDiffSegment = {
    type: 'equal' | 'add' | 'remove';
    text: string;
};

function getCreatedAtMs(row: FeedRowOutput) {
    const timestamp = Date.parse(String(row.created_at || ''));
    return Number.isFinite(timestamp) ? timestamp : 0;
}

/**
 * Merge adjacent Bio edits no more than 24 hours apart, matching the legacy
 * VRCX-jirai Bio Diff behavior. Return groups newest-first for the UI picker.
 */
export function groupBioHistoryRows(rows: FeedRowOutput[]): BioHistoryGroup[] {
    const chronological = [...rows].sort(
        (left, right) => getCreatedAtMs(left) - getCreatedAtMs(right)
    );
    const groups: BioHistoryGroup[] = [];

    for (const row of chronological) {
        const group = groups.at(-1);
        if (
            group &&
            getCreatedAtMs(row) - getCreatedAtMs(group.latest) <=
                BIO_CHANGE_MERGE_WINDOW_MS
        ) {
            group.latest = row;
            group.bio = row.bio || '';
            group.count += 1;
            continue;
        }

        groups.push({
            latest: row,
            earliest: row,
            previousBio: row.previousBio || '',
            bio: row.bio || '',
            count: 1
        });
    }

    return groups.reverse();
}

const BIO_TOKEN_PATTERN =
    /(\r?\n|[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]|[^\s\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+|\s+)/gu;

function tokenizeBio(value: string) {
    return value.match(BIO_TOKEN_PATTERN) || [];
}

/** Build a safe, CJK-aware inline diff without generating HTML. */
export function buildInlineBioDiff(
    previousBio: unknown,
    bio: unknown
): BioInlineDiffSegment[] {
    const previousTokens = tokenizeBio(String(previousBio ?? ''));
    const currentTokens = tokenizeBio(String(bio ?? ''));
    const rows = previousTokens.length + 1;
    const columns = currentTokens.length + 1;
    const lcs = Array.from({ length: rows }, () => new Uint32Array(columns));

    for (let row = previousTokens.length - 1; row >= 0; row -= 1) {
        for (let column = currentTokens.length - 1; column >= 0; column -= 1) {
            lcs[row][column] =
                previousTokens[row] === currentTokens[column]
                    ? lcs[row + 1][column + 1] + 1
                    : Math.max(lcs[row + 1][column], lcs[row][column + 1]);
        }
    }

    const segments: BioInlineDiffSegment[] = [];
    const append = (type: BioInlineDiffSegment['type'], text: string) => {
        const last = segments.at(-1);
        if (last?.type === type) {
            last.text += text;
        } else {
            segments.push({ type, text });
        }
    };

    let row = 0;
    let column = 0;
    while (row < previousTokens.length && column < currentTokens.length) {
        if (previousTokens[row] === currentTokens[column]) {
            append('equal', currentTokens[column]);
            row += 1;
            column += 1;
        } else if (lcs[row + 1][column] >= lcs[row][column + 1]) {
            append('remove', previousTokens[row]);
            row += 1;
        } else {
            append('add', currentTokens[column]);
            column += 1;
        }
    }
    while (row < previousTokens.length) {
        append('remove', previousTokens[row]);
        row += 1;
    }
    while (column < currentTokens.length) {
        append('add', currentTokens[column]);
        column += 1;
    }

    return segments;
}
