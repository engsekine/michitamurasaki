/** フォーム・出力で使う年月表記（例: 2026年7月）の相互変換。DB は YYYY-MM で保持する */

/** YYYY-MM →「YYYY年M月」（ゼロ埋めなし）。不正な形式は空文字 */
export const yearMonthToDisplay = (yearMonth: string | null): string => {
    if (!yearMonth) return '';
    const matched = yearMonth.match(/^(\d{4})-(\d{2})$/);
    if (!matched?.[1] || !matched[2]) return '';
    return `${matched[1]}年${Number(matched[2])}月`;
};

/** 「YYYY年M月」→ YYYY-MM（ゼロ埋め）。不正な形式・範囲外の月は null */
export const displayToYearMonth = (display: string): string | null => {
    const matched = display.match(/^(\d{4})年(\d{1,2})月$/);
    if (!matched?.[1] || !matched[2]) return null;
    const month = Number(matched[2]);
    if (month < 1 || month > 12) return null;
    return `${matched[1]}-${String(month).padStart(2, '0')}`;
};
