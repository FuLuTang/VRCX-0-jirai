import { describe, expect, it } from 'vitest';

import {
    buildLineDiff,
    localeIncludes,
    normalizeString,
    removeEmojis,
    replaceBioSymbols
} from './string';

describe('string utils', () => {
    it('matches locale-aware substrings with the supplied comparer', () => {
        const comparer = new Intl.Collator('en', {
            sensitivity: 'base'
        });

        expect(localeIncludes('Cafe noir', 'CAFÉ', comparer)).toBe(true);
        expect(localeIncludes('Cafe noir', 'tea', comparer)).toBe(false);
        expect(localeIncludes('Cafe noir', '', comparer)).toBe(true);
        expect(localeIncludes('', 'Cafe', comparer)).toBe(false);
    });

    it('trims strings and coerces non-string inputs', () => {
        expect(normalizeString('  hi  ')).toBe('hi');
        expect(normalizeString(null)).toBe('');
        expect(normalizeString(undefined)).toBe('');
        expect(normalizeString(42)).toBe('42');
        expect(normalizeString(true)).toBe('true');
    });

    it('normalizes bio symbols and removes emoji code points', () => {
        expect(replaceBioSymbols('Hi  ＠＃≺tag≻＼path  ')).toBe(
            'Hi @#<tag>\\path'
        );
        expect(replaceBioSymbols(null)).toBe('');
        expect(removeEmojis('Hello 😊 world ✨')).toBe('Hello world');
        expect(removeEmojis(null)).toBe('');
    });

    it('keeps unchanged Bio lines and marks additions and removals', () => {
        expect(buildLineDiff('first\nold\nlast', 'first\nnew\nlast')).toEqual([
            { type: 'equal', text: 'first' },
            { type: 'remove', text: 'old' },
            { type: 'add', text: 'new' },
            { type: 'equal', text: 'last' }
        ]);
    });
});
