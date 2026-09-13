import { describe, expect, it } from 'vitest';

import { isUuid, isValidHandle, normalizeHandle, profilePath, RESERVED_USER_SEGMENTS } from './profile-path';

const USER_ID = '000000bd-0000-0000-0000-000000000002';

describe('isUuid', () => {
    it.each([
        '000000bd-0000-0000-0000-000000000002',
        'A1B2C3D4-E5F6-7890-ABCD-EF0123456789', // 大文字も uuid とみなす
    ])('%s は true', (value) => {
        expect(isUuid(value)).toBe(true);
    });

    it.each(['buddy-taro', 'taro', '12345', 'not-a-uuid-000-000'])('%s は false', (value) => {
        expect(isUuid(value)).toBe(false);
    });
});

describe('normalizeHandle', () => {
    it('前後空白を除去し小文字化する', () => {
        expect(normalizeHandle('  TaroDiver ')).toBe('tarodiver');
    });
});

describe('isValidHandle', () => {
    it.each(['taro', 'buddy-taro', 'user_01', 'abc', 'a12', 'a'.repeat(30)])('%s は valid', (value) => {
        expect(isValidHandle(value)).toBe(true);
    });

    it.each([
        'ab', // 短すぎ
        'a'.repeat(31), // 長すぎ
        '1abc', // 先頭が数字
        '-abc', // 先頭が記号
        'Taro', // 大文字（保存前に normalizeHandle 済みであること）
        'たろう', // 日本語
        'a b', // スペース
        'a.b', // 許可外記号
        '', // 空
    ])('%j は invalid', (value) => {
        expect(isValidHandle(value)).toBe(false);
    });

    it.each(['search'])('予約セグメント %j は invalid', (value) => {
        expect(isValidHandle(value)).toBe(false);
    });

    it('RESERVED_USER_SEGMENTS には search が含まれる', () => {
        expect(RESERVED_USER_SEGMENTS).toContain('search');
    });
});

describe('profilePath', () => {
    it('handle があればユーザー ID の URL を返す', () => {
        expect(profilePath({ userId: USER_ID, handle: 'buddy-taro' })).toBe('/users/buddy-taro');
    });

    it('handle 未指定（null / undefined / 空文字）は内部 ID の URL にフォールバックする（ページ側の転送で正規化される）', () => {
        expect(profilePath({ userId: USER_ID })).toBe(`/users/${USER_ID}`);
        expect(profilePath({ userId: USER_ID, handle: null })).toBe(`/users/${USER_ID}`);
        expect(profilePath({ userId: USER_ID, handle: '' })).toBe(`/users/${USER_ID}`);
    });
});
