/** 日本時間の今日（YYYY-MM-DD）。実体は @repo/core（029 でモバイルと共有化） */
export { todayInJst } from '@repo/core';

/**
 * YYYY-MM-DD の日付文字列を YYYY/MM/DD 表示に整形する純粋関数。
 * 想定外の形式（要素が 3 つ揃わない）はそのまま返し、"undefined" 混入を防ぐ。
 */
export const formatJstDate = (isoDate: string): string => {
    const [year, month, day] = isoDate.split('-');
    if (!year || !month || !day) return isoDate;
    return `${year}/${month}/${day}`;
};

/** 曜日の表示ラベル（getUTCDay の並び） */
const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const;

/**
 * YYYY-MM-DD の日付文字列を「YYYY/MM/DD（曜）」表示に整形する純粋関数。
 * 想定外の形式・不正な日付はそのまま返し、"undefined" 混入を防ぐ。
 */
export const formatJstDateWithWeekday = (isoDate: string): string => {
    const parsed = Date.parse(`${isoDate}T00:00:00Z`);
    if (Number.isNaN(parsed)) return isoDate;
    const weekday = WEEKDAY_LABELS[new Date(parsed).getUTCDay()];
    return `${formatJstDate(isoDate)}（${weekday}）`;
};

/**
 * timestamptz の ISO 文字列を JST の「YYYY/MM/DD HH:mm」表示に整形する。
 * 解析できない文字列はそのまま返し、"Invalid Date" 混入を防ぐ。
 */
export const formatJstDateTime = (isoDateTime: string): string => {
    const parsed = new Date(isoDateTime);
    if (Number.isNaN(parsed.getTime())) return isoDateTime;
    const date = parsed.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' }).replaceAll('-', '/');
    const time = parsed.toLocaleTimeString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
    return `${date} ${time}`;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * 基準日から対象日までの日数を返す純粋関数。
 * 同日 = 0、未来 = 正、過去 = 負。両引数とも YYYY-MM-DD（JST 基準の値を渡す）。
 */
export const daysUntil = (targetDate: string, today: string): number => {
    const target = Date.parse(`${targetDate}T00:00:00Z`);
    const base = Date.parse(`${today}T00:00:00Z`);
    return Math.round((target - base) / MS_PER_DAY);
};

/** YYYY-MM-DD の日付文字列が 1900-01-01 〜 当日の範囲内かチェック（生年月日用） */
export const isValidBirthDate = (value: string | undefined): boolean => {
    if (!value) return false;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    return date >= new Date('1900-01-01') && date <= new Date();
};
