import { describe, expect, it } from 'vitest';

import type { TimelineItem } from '@/features/social/types';
import { groupTimelineByDate, isTimelineEmpty } from './timeline';

const item = (id: string, diveDate: string): TimelineItem => ({
    diveId: id,
    diveDate,
    location: `loc-${id}`,
    maxDepthM: 18,
    bottomTimeMin: 40,
    ownerId: `owner-${id}`,
    ownerNickname: `nick-${id}`,
    ownerHandle: 'h-x',
    likeCount: 0,
    likedByMe: false,
});

describe('groupTimelineByDate', () => {
    it('連続する同一日付をまとめ、順序を保つ', () => {
        const groups = groupTimelineByDate([item('1', '2026-06-30'), item('2', '2026-06-30'), item('3', '2026-06-29')]);
        expect(groups).toHaveLength(2);
        expect(groups[0]).toMatchObject({ date: '2026-06-30' });
        expect(groups[0]?.items.map((i) => i.diveId)).toEqual(['1', '2']);
        expect(groups[1]).toMatchObject({ date: '2026-06-29' });
        expect(groups[1]?.items.map((i) => i.diveId)).toEqual(['3']);
    });

    it('空配列は空グループを返す', () => {
        expect(groupTimelineByDate([])).toEqual([]);
    });

    it('同じ日付が離れて出現する場合は別グループになる（降順前提のため通常は起きない）', () => {
        const groups = groupTimelineByDate([item('1', '2026-06-30'), item('2', '2026-06-29'), item('3', '2026-06-30')]);
        expect(groups).toHaveLength(3);
    });
});

describe('isTimelineEmpty', () => {
    it('空配列は true', () => {
        expect(isTimelineEmpty([])).toBe(true);
    });
    it('要素があれば false', () => {
        expect(isTimelineEmpty([item('1', '2026-06-30')])).toBe(false);
    });
});
