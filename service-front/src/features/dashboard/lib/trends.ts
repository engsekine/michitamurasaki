import type { MonthlyDiveStat, YearlyDiveCount } from '@/features/dashboard/types';

/**
 * 年別本数の歯抜け年を 0 本で補完する純粋関数（FR-003）。
 * 空配列は空配列のまま返す（「ログ 0 件」の判定値として使うため — research.md R-006）。
 */
export const fillYearlyGaps = (rows: YearlyDiveCount[]): YearlyDiveCount[] => {
    const firstRow = rows.at(0);
    const lastRow = rows.at(-1);
    if (!firstRow || !lastRow) return [];

    const countByYear = new Map(rows.map((row) => [row.year, row.diveCount]));

    return Array.from({ length: lastRow.year - firstRow.year + 1 }, (_, offset) => {
        const year = firstRow.year + offset;
        return { year, diveCount: countByYear.get(year) ?? 0 };
    });
};

/** 'YYYY-MM' を基準に offset ヶ月前の 'YYYY-MM' を返す */
const subtractMonths = (baseMonth: string, offset: number): string => {
    const year = Number(baseMonth.slice(0, 4));
    const month = Number(baseMonth.slice(5, 7));
    // Date の月は 0 始まり。日付を 1 日に固定して月単位の演算だけ行う
    const date = new Date(Date.UTC(year, month - 1 - offset, 1));
    const paddedMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${date.getUTCFullYear()}-${paddedMonth}`;
};

/**
 * 月別統計を baseMonth から遡る months 個の連続列に補完する純粋関数（FR-003）。
 * データのない月は本数 0。rows が空でも常に months 要素を返す
 * （無条件 0 埋め — 空状態の判定は呼び出し側が年別集計で行う。research.md R-006）。
 */
export const fillMonthlyGaps = (rows: MonthlyDiveStat[], baseMonth: string, months: number): MonthlyDiveStat[] => {
    const statByMonth = new Map(rows.map((row) => [row.month, row]));

    return Array.from({ length: months }, (_, index) => {
        const month = subtractMonths(baseMonth, months - 1 - index);
        return statByMonth.get(month) ?? { month, diveCount: 0 };
    });
};
