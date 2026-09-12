function localeIncludes(
    str: unknown,
    search: unknown,
    comparer: Pick<Intl.Collator, 'compare'>
): boolean {
    // These checks are stolen from https://stackoverflow.com/a/69623589/11030436
    if (search === '') {
        return true;
    } else if (!str || !search) {
        return false;
    }
    const strObj = String(str);
    const searchObj = String(search);

    if (strObj.length === 0) {
        return false;
    }

    if (searchObj.length > strObj.length) {
        return false;
    }

    for (let i = 0; i < strObj.length - searchObj.length + 1; i++) {
        const substr = strObj.substring(i, i + searchObj.length);
        if (comparer.compare(substr, searchObj) === 0) {
            return true;
        }
    }
    return false;
}

function replaceBioSymbols(text: unknown): string {
    if (typeof text !== 'string') {
        return '';
    }
    const symbolList: Record<string, string> = {
        '@': '＠',
        '#': '＃',
        $: '＄',
        '%': '％',
        '&': '＆',
        '=': '＝',
        '+': '＋',
        '/': '⁄',
        '\\': '＼',
        ';': ';',
        ':': '˸',
        ',': '‚',
        '?': '？',
        '!': 'ǃ',
        '"': '＂',
        '<': '≺',
        '>': '≻',
        '.': '․',
        '^': '＾',
        '{': '｛',
        '}': '｝',
        '[': '［',
        ']': '］',
        '(': '（',
        ')': '）',
        '|': '｜',
        '*': '∗'
    };
    let newText = text;
    for (const key in symbolList) {
        const regex = new RegExp(symbolList[key], 'g');
        newText = newText.replace(regex, key);
    }
    return newText.replace(/ {1,}/g, ' ').trimRight();
}

function normalizeString(value: unknown): string {
    return typeof value === 'string'
        ? value.trim()
        : String(value ?? '').trim();
}

function removeEmojis(text: unknown): string {
    if (!text) {
        return '';
    }
    return String(text)
        .replace(
            /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g,
            ''
        )
        .replace(/\s+/g, ' ')
        .trim();
}

export type LineDiff = {
    type: 'equal' | 'add' | 'remove';
    text: string;
};

/**
 * Returns a stable, line-oriented diff suitable for compact history viewers.
 * Bio text is user-authored and can be multiline, so word-level diffs tend to
 * obscure the changes more than they help.
 */
function buildLineDiff(
    previousText: unknown,
    currentText: unknown
): LineDiff[] {
    const left = String(previousText ?? '').split(/\r?\n/);
    const right = String(currentText ?? '').split(/\r?\n/);
    const table = Array.from({ length: left.length + 1 }, () =>
        Array.from({ length: right.length + 1 }, () => 0)
    );

    for (let row = left.length - 1; row >= 0; row -= 1) {
        for (let column = right.length - 1; column >= 0; column -= 1) {
            table[row][column] =
                left[row] === right[column]
                    ? table[row + 1][column + 1] + 1
                    : Math.max(table[row + 1][column], table[row][column + 1]);
        }
    }

    const lines: LineDiff[] = [];
    let row = 0;
    let column = 0;
    while (row < left.length && column < right.length) {
        if (left[row] === right[column]) {
            lines.push({ type: 'equal', text: left[row] });
            row += 1;
            column += 1;
        } else if (table[row + 1][column] >= table[row][column + 1]) {
            lines.push({ type: 'remove', text: left[row] });
            row += 1;
        } else {
            lines.push({ type: 'add', text: right[column] });
            column += 1;
        }
    }
    while (row < left.length) {
        lines.push({ type: 'remove', text: left[row] });
        row += 1;
    }
    while (column < right.length) {
        lines.push({ type: 'add', text: right[column] });
        column += 1;
    }
    return lines;
}

export {
    buildLineDiff,
    localeIncludes,
    normalizeString,
    replaceBioSymbols,
    removeEmojis
};
