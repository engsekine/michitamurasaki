/**
 * プロフィール URL の判定・生成の唯一の情報源（034 Rev.2）。
 * リンク生成（features 各所）・ルートの slug 判別（users/[slug]）・
 * ユーザー ID の登録検証（shared/schemas/user-profile）がすべてここを参照する。
 */

/** `/users/` 配下でプロフィール以外に使う予約セグメント。ユーザー ID として登録も解決もしない */
export const RESERVED_USER_SEGMENTS = ['search'] as const;

/**
 * ユーザー ID（handle）の形式（FR-002）。
 * 小文字英字始まり・小文字英数字と `-` `_`・計 3〜30 文字。保存前に normalizeHandle で小文字化する。
 */
export const HANDLE_PATTERN = /^[a-z][a-z0-9_-]{2,29}$/;

/** uuid 形式（内部 ID とユーザー ID の判別基準。ユーザー ID は最大 30 文字のため衝突しない） */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: string): boolean => UUID_PATTERN.test(value);

/** 入力・URL セグメントをユーザー ID の保存形（小文字・前後空白なし）へ正規化する */
export const normalizeHandle = (value: string): string => value.trim().toLowerCase();

/** ユーザー ID として登録・解決できる値か（FR-002/003。予約セグメントは拒否） */
export const isValidHandle = (value: string): boolean => {
    if (!HANDLE_PATTERN.test(value)) return false;
    if ((RESERVED_USER_SEGMENTS as readonly string[]).includes(value)) return false;
    return true;
};

interface ProfilePathInput {
    userId: string;
    /** 取得済みのユーザー ID。未取得のときは内部 ID の URL にフォールバックする */
    handle?: string | null | undefined;
}

/**
 * プロフィール URL を生成する（FR-004）。
 * handle は保存時に小文字英数字が保証されているためエンコード不要。
 * handle 未取得（metadata 未同期など）の内部 ID URL はページ側の転送で正規化される（FR-005）。
 */
export const profilePath = ({ userId, handle }: ProfilePathInput): string =>
    handle ? `/users/${handle}` : `/users/${userId}`;
