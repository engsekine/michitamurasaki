import { describe, expect, it } from 'vitest';

import { isScrolledToBottom } from './isScrolledToBottom';

describe('isScrolledToBottom', () => {
    it('最下部まで到達していれば true', () => {
        expect(isScrolledToBottom({ scrollTop: 900, clientHeight: 100, scrollHeight: 1000 })).toBe(true);
    });

    it('しきい値（既定 8px）以内なら true', () => {
        expect(isScrolledToBottom({ scrollTop: 895, clientHeight: 100, scrollHeight: 1000 })).toBe(true);
    });

    it('途中までしかスクロールしていなければ false', () => {
        expect(isScrolledToBottom({ scrollTop: 100, clientHeight: 100, scrollHeight: 1000 })).toBe(false);
    });

    it('コンテンツがビューより短い（スクロール不要）場合は true', () => {
        expect(isScrolledToBottom({ scrollTop: 0, clientHeight: 500, scrollHeight: 300 })).toBe(true);
    });
});
