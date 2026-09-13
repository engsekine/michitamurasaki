import { describe, expect, it } from 'vitest';

import { displayToYearMonth, yearMonthToDisplay } from './yearMonth';

describe('yearMonthToDisplay', () => {
    it('YYYY-MM を「YYYY年M月」（ゼロ埋めなし）へ変換する', () => {
        expect(yearMonthToDisplay('2026-07')).toBe('2026年7月');
        expect(yearMonthToDisplay('2026-12')).toBe('2026年12月');
    });

    it('空・不正な形式は空文字を返す', () => {
        expect(yearMonthToDisplay('')).toBe('');
        expect(yearMonthToDisplay('2026年7月')).toBe('');
        expect(yearMonthToDisplay(null)).toBe('');
    });
});

describe('displayToYearMonth', () => {
    it('「YYYY年M月」を YYYY-MM（ゼロ埋め）へ変換する', () => {
        expect(displayToYearMonth('2026年7月')).toBe('2026-07');
        expect(displayToYearMonth('2026年12月')).toBe('2026-12');
    });

    it('空・不正な形式は null を返す', () => {
        expect(displayToYearMonth('')).toBeNull();
        expect(displayToYearMonth('2026-07')).toBeNull();
        expect(displayToYearMonth('2026年13月')).toBeNull();
    });
});
