import { describe, expect, it } from 'vitest';

import { attachLikeInfo, buildLikeInfo } from './likes';

const VIEWER_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_ID = '22222222-2222-2222-2222-222222222222';

describe('buildLikeInfo', () => {
    it('dive_id ごとに件数を集計し、閲覧者の行があれば likedByMe=true にする', () => {
        const rows = [
            { dive_id: 'd1', user_id: VIEWER_ID },
            { dive_id: 'd1', user_id: OTHER_ID },
            { dive_id: 'd2', user_id: OTHER_ID },
        ];

        const info = buildLikeInfo(rows, VIEWER_ID);

        expect(info.get('d1')).toEqual({ likeCount: 2, likedByMe: true });
        expect(info.get('d2')).toEqual({ likeCount: 1, likedByMe: false });
    });

    it('viewerId が null なら likedByMe は常に false', () => {
        const rows = [{ dive_id: 'd1', user_id: VIEWER_ID }];

        const info = buildLikeInfo(rows, null);

        expect(info.get('d1')).toEqual({ likeCount: 1, likedByMe: false });
    });

    it('空配列は空の Map を返す', () => {
        expect(buildLikeInfo([], VIEWER_ID).size).toBe(0);
    });
});

describe('attachLikeInfo', () => {
    const item = (diveId: string) => ({
        diveId,
        likeCount: 0,
        likedByMe: false,
        location: `loc-${diveId}`,
    });

    it('Map にある dive はいいね情報で上書きし、無い dive は既定値のまま返す', () => {
        const info = new Map([['d1', { likeCount: 3, likedByMe: true }]]);

        const result = attachLikeInfo([item('d1'), item('d2')], info);

        expect(result[0]).toMatchObject({ diveId: 'd1', likeCount: 3, likedByMe: true, location: 'loc-d1' });
        expect(result[1]).toMatchObject({ diveId: 'd2', likeCount: 0, likedByMe: false });
    });

    it('元の配列・要素を変更しない（イミュータブル）', () => {
        const original = [item('d1')];
        const info = new Map([['d1', { likeCount: 5, likedByMe: true }]]);

        const result = attachLikeInfo(original, info);

        expect(original[0]?.likeCount).toBe(0);
        expect(result).not.toBe(original);
        expect(result[0]).not.toBe(original[0]);
    });
});
