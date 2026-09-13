/**
 * social feature のドメイン型（spec 021）。
 * DB スキーマ（snake_case）はマッピング層で camelCase に変換する。
 */

/** あるユーザーに対するフォロー状態と件数 */
export interface FollowState {
    /** 閲覧者が対象ユーザーをフォロー中か */
    isFollowing: boolean;
    /** 対象ユーザーのフォロワー数 */
    followerCount: number;
    /** 対象ユーザーがフォローしている数 */
    followingCount: number;
}

/** フォロー一覧 / フォロワー一覧の 1 ユーザー行 */
export interface FollowUser {
    userId: string;
    nickname: string;
    /** ユーザー ID（034。プロフィールリンク生成用） */
    handle: string;
    /** 閲覧者がこのユーザーをフォロー中か（一覧上のフォローボタン用） */
    isFollowing: boolean;
}

/** タイムライン / 公開ログ一覧の 1 項目（公開ダイブログの要約 + 所有者） */
export interface TimelineItem {
    diveId: string;
    /** ISO 8601 date (YYYY-MM-DD) */
    diveDate: string;
    location: string;
    maxDepthM: number;
    bottomTimeMin: number;
    ownerId: string;
    ownerNickname: string;
    /** 所有者のユーザー ID（034。プロフィールリンク生成用） */
    ownerHandle: string;
    /** いいね件数（spec 027 FR-004） */
    likeCount: number;
    /** 閲覧者がこのログをいいね済みか（spec 027 FR-005） */
    likedByMe: boolean;
}

/** キーセットページネーション用カーソル（dive_date desc, id desc） */
export interface TimelineCursor {
    diveDate: string;
    id: string;
}

/** タイムライン / 公開ログ一覧の 1 ページ */
export interface TimelinePage {
    items: TimelineItem[];
    nextCursor: TimelineCursor | null;
}

/** いいねしたログ一覧のキーセットカーソル（dive_likes.created_at desc, dive_id desc / spec 027） */
export interface LikedDivesCursor {
    /** いいねした日時（ISO 8601） */
    likedAt: string;
    diveId: string;
}

/** いいねしたログ一覧の 1 ページ（spec 027 FR-007） */
export interface LikedDivesPage {
    items: TimelineItem[];
    nextCursor: LikedDivesCursor | null;
}

/** 公開プロフィール（プロフィールページの表示モデル） */
export interface PublicProfile {
    userId: string;
    nickname: string;
    /** ユーザー ID（034。プロフィール URL の識別子） */
    handle: string;
    followState: FollowState;
}

/** フォロー一覧の種別 */
export type FollowListKind = 'following' | 'followers';
