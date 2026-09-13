import type { MonthlyDiveStat, YearlyDiveCount } from '@/features/dashboard/types';

import { fillMonthlyGaps, fillYearlyGaps } from './trends';

const yearly = (year: number, diveCount: number): YearlyDiveCount => ({ year, diveCount });

const monthly = (month: string, diveCount: number): MonthlyDiveStat => ({ month, diveCount });

/** 0 埋めされた月（本数 0） */
const emptyMonth = (month: string): MonthlyDiveStat => monthly(month, 0);

describe('fillYearlyGaps', () => {
    it('空配列は空配列のまま返す（ログ 0 件の判定に使うため 0 埋めしない）', () => {
        expect(fillYearlyGaps([])).toEqual([]);
    });

    it('単一年はそのまま返す', () => {
        expect(fillYearlyGaps([yearly(2026, 5)])).toEqual([yearly(2026, 5)]);
    });

    it('歯抜けの年を 0 本で補完する', () => {
        expect(fillYearlyGaps([yearly(2023, 10), yearly(2026, 4)])).toEqual([
            yearly(2023, 10),
            yearly(2024, 0),
            yearly(2025, 0),
            yearly(2026, 4),
        ]);
    });

    it('連続した年はそのまま返す', () => {
        expect(fillYearlyGaps([yearly(2025, 3), yearly(2026, 7)])).toEqual([yearly(2025, 3), yearly(2026, 7)]);
    });
});

describe('fillMonthlyGaps', () => {
    it('rows が空でも基準月から遡る 12 要素の 0 本列を返す', () => {
        const result = fillMonthlyGaps([], '2026-06', 12);
        expect(result).toHaveLength(12);
        expect(result[0]).toEqual(emptyMonth('2025-07'));
        expect(result[11]).toEqual(emptyMonth('2026-06'));
        expect(result.every((stat) => stat.diveCount === 0)).toBe(true);
    });

    it('データのある月はそのまま・ない月は 0 本で補完し、12 要素を昇順で返す', () => {
        const rows = [monthly('2025-08', 3), monthly('2026-02', 1)];
        const result = fillMonthlyGaps(rows, '2026-06', 12);

        expect(result).toHaveLength(12);
        expect(result.map((stat) => stat.month)).toEqual([
            '2025-07',
            '2025-08',
            '2025-09',
            '2025-10',
            '2025-11',
            '2025-12',
            '2026-01',
            '2026-02',
            '2026-03',
            '2026-04',
            '2026-05',
            '2026-06',
        ]);
        expect(result[1]).toEqual(monthly('2025-08', 3));
        expect(result[7]).toEqual(monthly('2026-02', 1));
        expect(result[0]).toEqual(emptyMonth('2025-07'));
    });

    it('年を跨がない期間（基準 2026-12 / 3 ヶ月）も補完できる', () => {
        const result = fillMonthlyGaps([monthly('2026-11', 2)], '2026-12', 3);
        expect(result).toEqual([emptyMonth('2026-10'), monthly('2026-11', 2), emptyMonth('2026-12')]);
    });

    it('1 月から前年へ正しく繰り下がる（基準 2026-01 / 2 ヶ月）', () => {
        const result = fillMonthlyGaps([], '2026-01', 2);
        expect(result.map((stat) => stat.month)).toEqual(['2025-12', '2026-01']);
    });
});
