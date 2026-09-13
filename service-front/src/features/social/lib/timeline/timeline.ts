import type { TimelineItem } from '@/features/social/types';

/** 日付ごとにグループ化したタイムライン（表示で日付見出しを付けるため） */
export interface TimelineDateGroup {
    /** ISO 8601 date (YYYY-MM-DD) */
    date: string;
    items: TimelineItem[];
}

/**
 * タイムライン項目を diveDate ごとにグループ化する（spec 021 US4）。
 * 入力は新しい順（dive_date 降順）前提で、順序を保ったまま連続する同一日付をまとめる。
 */
export const groupTimelineByDate = (items: TimelineItem[]): TimelineDateGroup[] => {
    const groups: TimelineDateGroup[] = [];
    for (const item of items) {
        const last = groups.at(-1);
        if (last && last.date === item.diveDate) {
            last.items.push(item);
        } else {
            groups.push({ date: item.diveDate, items: [item] });
        }
    }
    return groups;
};

/** タイムラインが空か（フォロー 0 / 公開ログ 0 の空状態判定に使う） */
export const isTimelineEmpty = (items: TimelineItem[]): boolean => items.length === 0;
