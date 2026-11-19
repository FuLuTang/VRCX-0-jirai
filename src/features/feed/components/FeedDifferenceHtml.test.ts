import { describe, expect, it } from 'vitest';

import { escapeHtml, formatDifferenceHtml } from './FeedDifferenceHtml';

const ADD = '<ins>{{text}}</ins>';
const DEL = '<del>{{text}}</del>';

describe('FeedDifferenceHtml', () => {
    it('escapes HTML-sensitive characters and preserves line breaks', () => {
        expect(escapeHtml(`<img src="x" onerror='alert(&)'>\nnext`)).toBe(
            '&lt;img src=&quot;x&quot; onerror=&#039;alert(&amp;)&#039;&gt;<br>next'
        );
        expect(escapeHtml(null)).toBe('');
    });

    it('renders inserted and deleted words around unchanged text', () => {
        expect(
            formatDifferenceHtml('hello old world', 'hello new world', ADD, DEL)
        ).toBe('hello <del>old</del> <ins>new</ins> world');
    });

    it('escapes changed bio content before wrapping diff markers', () => {
        expect(
            formatDifferenceHtml(
                'safe <script>alert(1)</script>',
                'safe <img src=x onerror=alert(1)>',
                ADD,
                DEL
            )
        ).toBe(
            'safe <del>&lt;script&gt;alert(1)&lt;/script&gt;</del> <ins>&lt;img src=x onerror=alert(1)&gt;</ins>'
        );
    });

    it('keeps line breaks outside inserted and deleted text chunks', () => {
        expect(formatDifferenceHtml('first\nold', 'first\nnew', ADD, DEL)).toBe(
            'first <br><del>old</del> <ins>new</ins>'
        );
    });

    // A6-F1: CJK characters are compared one by one.
    it('marks only the changed Han character in a Chinese bio', () => {
        expect(formatDifferenceHtml('今天很开心', '今天很难过', ADD, DEL)).toBe(
            '今天很<del>开心</del><ins>难过</ins>'
        );
        expect(formatDifferenceHtml('我喜欢猫', '我喜欢狗', ADD, DEL)).toBe(
            '我喜欢<del>猫</del><ins>狗</ins>'
        );
    });

    it('marks only the CJK part in mixed Latin and Chinese text', () => {
        expect(formatDifferenceHtml('VRChat玩家', 'VRChat好友', ADD, DEL)).toBe(
            'VRChat<del>玩家</del><ins>好友</ins>'
        );
    });

    it('compares Japanese kana and Korean Hangul character by character', () => {
        expect(formatDifferenceHtml('よろしくね', 'よろしくお', ADD, DEL)).toBe(
            'よろしく<del>ね</del><ins>お</ins>'
        );
        expect(
            formatDifferenceHtml('안녕하세요', '안녕하십시오', ADD, DEL)
        ).toBe('안녕하<del>세요</del><ins>십시오</ins>');
    });

    // A6-F2: no spaces that the original text did not have.
    it('does not insert spaces between CJK characters when joining', () => {
        const html = formatDifferenceHtml(
            '欢迎来到我的世界\n一起玩吧',
            '欢迎来到你的世界\n一起玩吧',
            ADD,
            DEL
        );
        expect(html).toBe(
            '欢迎来到<del>我</del><ins>你</ins>的世界<br>一起玩吧'
        );
        expect(html.replace(/<[^>]+>/g, '')).not.toMatch(
            /[\p{Script=Han}] |\s[\p{Script=Han}]/u
        );
    });

    it('joins like jirai: no space next to a CJK character, spaces kept between Latin words', () => {
        // Same as jirai columns.jsx joinTokens: whitespace is not tracked, so a
        // space that sat next to a CJK character is not reproduced.
        expect(
            formatDifferenceHtml(
                'hello there 世界 again',
                'hello there 世間 again',
                ADD,
                DEL
            )
        ).toBe('hello there世<del>界</del><ins>間</ins>again');
    });

    // A6-F3: pure Latin output is byte-identical to the previous implementation.
    it('produces exactly the previous output for Latin-only text', () => {
        const cases: Array<[string, string, string]> = [
            [
                'hello old world',
                'hello new world',
                'hello <del>old</del> <ins>new</ins> world'
            ],
            [
                'first\nold',
                'first\nnew',
                'first <br><del>old</del> <ins>new</ins>'
            ],
            ['a b c', 'a x c', 'a <del>b</del> <ins>x</ins> c'],
            [
                'first\nsecond',
                'third',
                '<del>first </del> <br><del> second</del> <ins>third</ins>'
            ],
            ['', 'brand new bio', '<ins>brand new bio</ins>'],
            [' lead\ttab end ', 'lead tab  end', 'lead tab end'],
            ['x\n\ny', 'x\ny z', 'x <br><br>y <ins>z</ins>'],
            [
                'one two three four',
                'four three two one',
                '<del>one two three</del> four <ins>three two one</ins>'
            ],
            [
                'old  spaced\n\nlines',
                'old spaced\n\nlines!',
                'old spaced <br><br><del>lines</del> <ins>lines!</ins>'
            ]
        ];
        for (const [oldValue, newValue, expected] of cases) {
            expect(formatDifferenceHtml(oldValue, newValue, ADD, DEL)).toBe(
                expected
            );
        }
    });
});
