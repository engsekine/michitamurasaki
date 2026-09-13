/**
 * いいね行の集計・マージ（spec 027 FR-004/005）。
 * 表示対象の dive ID 群に対する dive_likes 行（バッチ 1 クエリ）から
 * 件数と閲覧者のいいね済み状態を組み立て、一覧項目に後付けする。
 */

/** dive_likes の 1 行（集計に必要な列のみ） */
export interface LikeRow {
    dive_id: string;
    user_id: string;
}

/** 1 ログ分のいいね表示情報 */
export interface DiveLikeInfo {
    likeCount: number;
    likedByMe: boolean;
}

/** いいね行を dive_id ごとに集計する。viewerId が null（未ログイン）なら likedByMe は常に false */
export const buildLikeInfo = (rows: LikeRow[], viewerId: string | null): Map<string, DiveLikeInfo> => {
    const info = new Map<string, DiveLikeInfo>();
    for (const row of rows) {
        const current = info.get(row.dive_id) ?? { likeCount: 0, likedByMe: false };
        info.set(row.dive_id, {
            likeCount: current.likeCount + 1,
            likedByMe: current.likedByMe || row.user_id === viewerId,
        });
    }
    return info;
};

/** 一覧項目群にいいね情報をマージする（Map に無い dive は既定値のまま）。元の配列は変更しない */
export const attachLikeInfo = <T extends { diveId: string; likeCount: number; likedByMe: boolean }>(
    items: T[],
    info: Map<string, DiveLikeInfo>,
): T[] => items.map((item) => ({ ...item, ...(info.get(item.diveId) ?? {}) }));
