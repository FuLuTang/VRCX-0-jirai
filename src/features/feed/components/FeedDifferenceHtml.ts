function escapeHtml(value: unknown): string {
    return String(value ?? '')
        .replaceAll(/&/g, '&amp;')
        .replaceAll(/</g, '&lt;')
        .replaceAll(/>/g, '&gt;')
        .replaceAll(/"/g, '&quot;')
        .replaceAll(/'/g, '&#039;')
        .replaceAll(/\n/g, '<br>');
}

// Same script set as the profile Bio history diff (bioHistory.ts): Han,
// Hiragana, Katakana and Hangul characters are compared one by one.
const CJK_CHAR_PATTERN =
    /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]$/u;
const CJK_SPLIT_PATTERN =
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]|[^\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+/gu;

function isCjkChar(token: string): boolean {
    return CJK_CHAR_PATTERN.test(token);
}

/** Whitespace words, then `<br>`, then every CJK character on its own. */
function tokenize(escaped: string): string[] {
    return escaped
        .split(/\s+/)
        .flatMap((word) => word.split(/(<br>)/))
        .flatMap((word) =>
            word === '<br>' || word === ''
                ? [word]
                : (word.match(CJK_SPLIT_PATTERN) ?? [word])
        );
}

/** Join tokens with a space, except next to a CJK character. */
function joinTokens(tokens: readonly string[]): string {
    let text = '';
    for (let i = 0; i < tokens.length; i += 1) {
        if (i > 0 && !isCjkChar(tokens[i - 1]) && !isCjkChar(tokens[i])) {
            text += ' ';
        }
        text += tokens[i];
    }
    return text;
}

type DiffPiece = {
    html: string;
    startsWithCjk: boolean;
    endsWithCjk: boolean;
};

/** `text` is the unwrapped text; its edge characters decide the spacing. */
function textPiece(html: string, text: string): DiffPiece {
    const chars = Array.from(text);
    return {
        html,
        startsWithCjk: chars.length > 0 && isCjkChar(chars[0]),
        endsWithCjk: chars.length > 0 && isCjkChar(chars[chars.length - 1])
    };
}

function joinPieces(pieces: readonly DiffPiece[]): string {
    let html = '';
    for (let i = 0; i < pieces.length; i += 1) {
        if (i > 0 && !pieces[i - 1].endsWithCjk && !pieces[i].startsWithCjk) {
            html += ' ';
        }
        html += pieces[i].html;
    }
    return html;
}

function formatDifferenceHtml(
    oldValue: unknown,
    newValue: unknown,
    markerAddition = '<span class="rounded bg-primary/10 px-0.5 text-primary">{{text}}</span>',
    markerDeletion = '<span class="rounded bg-destructive/10 px-0.5 text-destructive line-through">{{text}}</span>'
): string {
    const oldWords = tokenize(escapeHtml(oldValue));
    const newWords = tokenize(escapeHtml(newValue));

    function findLongestMatch(
        oldStart: number,
        oldEnd: number,
        newStart: number,
        newEnd: number
    ): { newStart: number; oldStart: number; size: number } {
        let bestOldStart = oldStart;
        let bestNewStart = newStart;
        let bestSize = 0;
        const lookup = new Map<string, number[]>();

        for (let i = oldStart; i < oldEnd; i += 1) {
            const word = oldWords[i];
            let positions = lookup.get(word);
            if (!positions) {
                positions = [];
                lookup.set(word, positions);
            }
            positions.push(i);
        }

        for (let j = newStart; j < newEnd; j += 1) {
            const word = newWords[j];
            const positions = lookup.get(word);
            if (!positions) {
                continue;
            }
            for (const i of positions) {
                let size = 0;
                while (
                    i + size < oldEnd &&
                    j + size < newEnd &&
                    oldWords[i + size] === newWords[j + size]
                ) {
                    size += 1;
                }
                if (size > bestSize) {
                    bestOldStart = i;
                    bestNewStart = j;
                    bestSize = size;
                }
            }
        }

        return {
            oldStart: bestOldStart,
            newStart: bestNewStart,
            size: bestSize
        };
    }

    function build(
        words: string[],
        start: number,
        end: number,
        pattern: string
    ): DiffPiece[] {
        const result: DiffPiece[] = [];
        const parts = joinTokens(
            words.slice(start, end).filter((word) => word.length > 0)
        ).split('<br>');

        for (let i = 0; i < parts.length; i += 1) {
            if (i > 0) {
                result.push(textPiece('<br>', ''));
            }
            if (parts[i].length > 0) {
                result.push(
                    textPiece(
                        pattern.replace('{{text}}', () => parts[i]),
                        parts[i]
                    )
                );
            }
        }
        return result;
    }

    function buildDiff(
        oldStart: number,
        oldEnd: number,
        newStart: number,
        newEnd: number
    ): DiffPiece[] {
        const result: DiffPiece[] = [];
        const match = findLongestMatch(oldStart, oldEnd, newStart, newEnd);

        if (match.size > 0) {
            if (oldStart < match.oldStart || newStart < match.newStart) {
                result.push(
                    ...buildDiff(
                        oldStart,
                        match.oldStart,
                        newStart,
                        match.newStart
                    )
                );
            }
            const matched = oldWords.slice(
                match.oldStart,
                match.oldStart + match.size
            );
            const text = joinTokens(matched);
            result.push(textPiece(text, text));
            if (
                match.oldStart + match.size < oldEnd ||
                match.newStart + match.size < newEnd
            ) {
                result.push(
                    ...buildDiff(
                        match.oldStart + match.size,
                        oldEnd,
                        match.newStart + match.size,
                        newEnd
                    )
                );
            }
        } else {
            if (oldStart < oldEnd) {
                result.push(
                    ...build(oldWords, oldStart, oldEnd, markerDeletion)
                );
            }
            if (newStart < newEnd) {
                result.push(
                    ...build(newWords, newStart, newEnd, markerAddition)
                );
            }
        }

        return result;
    }

    return joinPieces(buildDiff(0, oldWords.length, 0, newWords.length))
        .replace(/<br>[ ]+<br>/g, '<br><br>')
        .replace(/<br> /g, '<br>');
}

export { escapeHtml, formatDifferenceHtml };
