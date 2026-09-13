import { vi } from 'vitest';

import { formatJstDate, formatJstDateTime, formatJstDateWithWeekday, isValidBirthDate, todayInJst } from './date';

describe('todayInJst', () => {
    it('YYYY-MM-DD 形式の文字列を返す', () => {
        expect(todayInJst()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('JST の日付を返す（UTC が前日でも JST の今日になる）', () => {
        vi.useFakeTimers();
        // UTC 2026-06-09 23:00 = JST 2026-06-10 08:00
        vi.setSystemTime(new Date('2026-06-09T23:00:00Z'));

        expect(todayInJst()).toBe('2026-06-10');

        vi.useRealTimers();
    });
});

describe('formatJstDate', () => {
    it('YYYY-MM-DD を YYYY/MM/DD に整形する', () => {
        expect(formatJstDate('2026-06-10')).toBe('2026/06/10');
    });

    it('要素が揃わない不正な形式はそのまま返す', () => {
        expect(formatJstDate('2026-06')).toBe('2026-06');
        expect(formatJstDate('invalid')).toBe('invalid');
    });
});

describe('isValidBirthDate', () => {
    it('1900-01-01 〜 当日の範囲内なら true', () => {
        expect(isValidBirthDate('1990-01-01')).toBe(true);
        expect(isValidBirthDate('1900-01-01')).toBe(true);
    });

    it('1900-01-01 より前は false', () => {
        expect(isValidBirthDate('1899-12-31')).toBe(false);
    });

    it('未来日は false', () => {
        expect(isValidBirthDate('2999-01-01')).toBe(false);
    });

    it('不正な日付文字列は false', () => {
        expect(isValidBirthDate('invalid')).toBe(false);
    });

    it('undefined / 空文字は false', () => {
        expect(isValidBirthDate(undefined)).toBe(false);
        expect(isValidBirthDate('')).toBe(false);
    });
});

describe('formatJstDateTime', () => {
    it('UTC の timestamptz を JST の YYYY/MM/DD HH:mm に整形する', () => {
        // UTC 15:30 = JST 翌日 00:30（日付跨ぎを含めて検証）
        expect(formatJstDateTime('2026-07-01T15:30:00+00:00')).toBe('2026/07/02 00:30');
    });

    it('JST オフセット付きの文字列も同じ時刻に整形する', () => {
        expect(formatJstDateTime('2026-07-02T09:05:00+09:00')).toBe('2026/07/02 09:05');
    });

    it('解析できない文字列はそのまま返す', () => {
        expect(formatJstDateTime('not-a-date')).toBe('not-a-date');
    });
});

describe('formatJstDateWithWeekday', () => {
    it('YYYY/MM/DD（曜）形式に整形する', () => {
        expect(formatJstDateWithWeekday('2026-07-12')).toBe('2026/07/12（日）');
        expect(formatJstDateWithWeekday('2026-07-07')).toBe('2026/07/07（火）');
    });

    it('不正な形式はそのまま返す', () => {
        expect(formatJstDateWithWeekday('invalid')).toBe('invalid');
    });
});
