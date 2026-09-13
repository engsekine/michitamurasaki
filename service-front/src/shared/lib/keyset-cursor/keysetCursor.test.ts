import { describe, expect, it } from 'vitest';

import { isSafeKeysetCursor, isSafeKeysetValue } from './keysetCursor';

describe('isSafeKeysetValue', () => {
    it('UUID・ISO 日付・ISO タイムスタンプを許可する', () => {
        expect(isSafeKeysetValue('0b8f4e2a-1111-4222-8333-444444444444')).toBe(true);
        expect(isSafeKeysetValue('2026-07-06')).toBe(true);
        expect(isSafeKeysetValue('2026-07-06T12:00:00.123456+00:00')).toBe(true);
        expect(isSafeKeysetValue('2026-07-06 12:00:00+00')).toBe(true);
        expect(isSafeKeysetValue('2026-07-06T12:00:00Z')).toBe(true);
    });

    it('PostgREST のフィルタ構文を含む値・非文字列は拒否する', () => {
        expect(isSafeKeysetValue('2026-07-06,user_id.neq.0')).toBe(false);
        expect(isSafeKeysetValue('x),and(id.gt.0')).toBe(false);
        expect(isSafeKeysetValue('')).toBe(false);
        expect(isSafeKeysetValue(123)).toBe(false);
        expect(isSafeKeysetValue(null)).toBe(false);
    });
});

describe('isSafeKeysetCursor', () => {
    it('全ての値が安全なら true', () => {
        expect(isSafeKeysetCursor({ diveDate: '2026-07-06', id: '0b8f4e2a-1111-4222-8333-444444444444' })).toBe(true);
        expect(
            isSafeKeysetCursor({
                likedAt: '2026-07-06T12:00:00+00:00',
                diveId: '0b8f4e2a-1111-4222-8333-444444444444',
            }),
        ).toBe(true);
    });

    it('1 つでも不正な値があれば false', () => {
        expect(isSafeKeysetCursor({ diveDate: '2026-07-06', id: 'abc,user_id.neq.0' })).toBe(false);
    });

    it('空のカーソルは false', () => {
        expect(isSafeKeysetCursor({})).toBe(false);
    });
});
