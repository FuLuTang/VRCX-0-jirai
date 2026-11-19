import { describe, expect, it } from 'vitest';

import {
    createEmptyQuickSearchState,
    type QuickSearchResult
} from '../quickSearch';
import {
    filterQuickSearchResults,
    mergeQuickSearchGroupInstances,
    normalizeSearchQuery,
    parseQuickSearchPrefix
} from './quickSearchResultModel';

function result(id: string, name: string): QuickSearchResult {
    return {
        id,
        name,
        type: 'friend',
        source: 'test',
        subtitle: '',
        imageUrl: '',
        seedData: null,
        memo: '',
        note: '',
        matchedField: 'name',
        userColour: ''
    };
}

describe('quick search result model', () => {
    it('normalizes whitespace and confusable characters in queries', () => {
        expect(normalizeSearchQuery('  ⓐlpha  BETA ')).toBe('alphabeta');
    });

    it('sorts prefix matches first and limits local results to eight', () => {
        const rows = [
            result('9', 'Zed alpha'),
            result('1', 'Alpha 9'),
            result('2', 'Alpha 8'),
            result('3', 'Alpha 7'),
            result('4', 'Alpha 6'),
            result('5', 'Alpha 5'),
            result('6', 'Alpha 4'),
            result('7', 'Alpha 3'),
            result('8', 'Alpha 2'),
            result('10', 'Beta alpha')
        ];

        const filtered = filterQuickSearchResults(rows, 'alpha');

        expect(filtered).toHaveLength(8);
        expect(filtered.map((row) => row.name)).toEqual([
            'Alpha 2',
            'Alpha 3',
            'Alpha 4',
            'Alpha 5',
            'Alpha 6',
            'Alpha 7',
            'Alpha 8',
            'Alpha 9'
        ]);
    });

    it('merges matching in-memory group instances without duplicates', () => {
        const state = {
            ...createEmptyQuickSearchState('ready'),
            joinedGroups: [
                {
                    ...result('grp_existing', 'Alpha Existing'),
                    type: 'group' as const
                }
            ]
        };

        const merged = mergeQuickSearchGroupInstances(state, 'alpha', [
            {
                groupId: 'grp_existing',
                groupName: 'Alpha Duplicate'
            },
            {
                groupId: 'grp_instance',
                groupName: 'Alpha Instance',
                worldName: 'World'
            },
            {
                groupId: 'grp_other',
                groupName: 'Other Group'
            }
        ]);

        expect(merged.joinedGroups.map((row) => row.id)).toEqual([
            'grp_existing',
            'grp_instance'
        ]);
    });

    it('parses the ! @ # category prefixes (M4)', () => {
        expect(parseQuickSearchPrefix('!')).toEqual({
            mode: 'friends',
            rest: ''
        });
        expect(parseQuickSearchPrefix('@wo')).toEqual({
            mode: 'worlds',
            rest: 'wo'
        });
        expect(parseQuickSearchPrefix('#g')).toEqual({
            mode: 'groups',
            rest: 'g'
        });
        for (const query of ['', 'alpha', 'a!b', 'a#b', 'usr_1']) {
            expect(parseQuickSearchPrefix(query)).toBeNull();
        }
    });

    it('merges group instances from one character in # mode and lists all for bare # (A17-9)', () => {
        const instances = Array.from({ length: 10 }, (_, index) => ({
            id: `inst_${index}`,
            groupId: `grp_${index}`,
            groupName: index === 0 ? 'Zeta' : `Group ${index}`
        }));
        const empty = createEmptyQuickSearchState('ready');

        const one = mergeQuickSearchGroupInstances(empty, '#z', instances);
        expect(one.joinedGroups.map((row) => row.id)).toEqual(['grp_0']);

        const all = mergeQuickSearchGroupInstances(empty, '#', instances);
        expect(all.joinedGroups).toHaveLength(10);
    });

    it('does not merge group instances in ! and @ modes', () => {
        const instances = [
            { id: 'inst', groupId: 'grp_1', groupName: 'Alpha' }
        ];
        const empty = createEmptyQuickSearchState('ready');
        expect(
            mergeQuickSearchGroupInstances(empty, '!alpha', instances)
                .joinedGroups
        ).toEqual([]);
        expect(
            mergeQuickSearchGroupInstances(empty, '@alpha', instances)
                .joinedGroups
        ).toEqual([]);
    });

    it('keeps the unprefixed two-character threshold (A17-11)', () => {
        const instances = [
            { id: 'inst', groupId: 'grp_1', groupName: 'Alpha' }
        ];
        const empty = createEmptyQuickSearchState('ready');
        expect(
            mergeQuickSearchGroupInstances(empty, 'a', instances).joinedGroups
        ).toEqual([]);
        expect(
            mergeQuickSearchGroupInstances(empty, 'al', instances).joinedGroups
                .length
        ).toBe(1);
    });
});
