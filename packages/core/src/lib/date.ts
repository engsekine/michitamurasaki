/**
 * 日本時間の「今日」（YYYY-MM-DD）。
 * ダイブ日の上限判定に使う（Web / モバイル共有。service-front の shared/lib/date から移設）。
 * en-CA ロケールは YYYY-MM-DD 形式を返す。
 */
export const todayInJst = (): string => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
