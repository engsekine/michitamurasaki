import type { TankTypeValue } from '@/features/dives/constants';

/** ログに紐づくダイブサイト（マスタ）の最小参照 */
export interface DiveSiteRef {
    id: string;
    name: string;
    area: string | null;
}

/** ログに紐付けたショップの最小参照（033。feature 間 import を避けるため独自定義） */
export interface DiveShopRef {
    id: string;
    name: string;
}

/** ログに紐付けたショップの最小参照（033。feature 間 import を避けるため独自定義） */
export interface DiveShopRef {
    id: string;
    name: string;
}

/** ダイビングログのドメイン型。DB スキーマ（snake_case）はマッピング層で camelCase に変換する */
export interface Dive {
    id: string;
    userId: string;
    diveNumber: number | null;
    /** ISO 8601 date string (YYYY-MM-DD) */
    diveDate: string;
    /** HH:MM:SS */
    entryTime: string | null;
    /** HH:MM:SS */
    exitTime: string | null;
    /** 自由入力のポイント名。サイト参照時は null（表示名はマスタから取得） */
    location: string | null;
    /** ダイブサイト（マスタ）への参照。自由入力時は null */
    diveSiteId: string | null;
    /** 参照中ダイブサイトの要約（表示用）。自由入力時は null */
    diveSite: DiveSiteRef | null;
    /** 紐付けたショップ id（033）。未紐付けは null */
    diveShopId: string | null;
    /** 紐付けたショップの要約（本人向け表示用）。未紐付けは null */
    shop: DiveShopRef | null;
    diveType: string | null;
    weather: string | null;
    airTempC: number | null;
    waterTempC: number | null;
    visibilityM: number | null;
    wave: string | null;
    currentCondition: string | null;
    maxDepthM: number;
    avgDepthM: number | null;
    bottomTimeMin: number;
    tankType: TankTypeValue | null;
    tankVolumeL: number | null;
    gasType: string | null;
    o2Percent: number | null;
    pressureStartBar: number | null;
    pressureEndBar: number | null;
    weightKg: number | null;
    suitType: string | null;
    equipmentNotes: string | null;
    buddyName: string | null;
    instructorName: string | null;
    certificationDive: boolean;
    notes: string | null;
    isPublic: boolean;
    publicSlug: string | null;
    /** ISO 8601 timestamp */
    createdAt: string;
    /** ISO 8601 timestamp */
    updatedAt: string;
}

/** 一覧表示で必要な最低限の列だけを持つ軽量版 */
export type DiveListItem = Pick<
    Dive,
    | 'id'
    | 'diveNumber'
    | 'diveDate'
    | 'location'
    | 'diveSite'
    | 'maxDepthM'
    | 'bottomTimeMin'
    | 'waterTempC'
    | 'visibilityM'
    | 'certificationDive'
>;

/** 一覧検索の入力。すべて任意で、指定された条件は AND で組み合わさる */
export interface DiveListFilter {
    diveNumber?: number;
    /** 期間の開始日（含む）。ISO 8601 date string (YYYY-MM-DD) */
    dateFrom?: string;
    /** 期間の終了日（含む）。ISO 8601 date string (YYYY-MM-DD) */
    dateTo?: string;
    /** 最大水深の下限（m・含む） */
    depthMin?: number;
    /** 最大水深の上限（m・含む） */
    depthMax?: number;
    /** ダイブタイプ（DIVE_TYPE_OPTIONS の value） */
    diveType?: string;
    location?: string;
    /** バディ（登録ユーザー）の user_id で絞り込み（spec 021 FR-022） */
    buddyUserId?: string;
    /** バディ名（フリーテキスト）の部分一致で絞り込み（spec 021 FR-022） */
    buddyName?: string;
}

/** キーセットページネーションのカーソル */
export interface DiveCursor {
    /** ISO 8601 date string (YYYY-MM-DD) */
    diveDate: string;
    id: string;
}

export interface DiveListPage {
    items: DiveListItem[];
    /** 次のページがあるときのカーソル。無いとき null */
    nextCursor: DiveCursor | null;
}

/** dive_photos の 1 行（snake_case から camelCase へ変換後）。012-photo-attachments */
export interface DivePhoto {
    id: string;
    diveId: string;
    /** 表示用 WebP の Storage パス（{user_id}/{dive_id}/display/{id}.webp） */
    displayPath: string;
    /** サムネイル WebP の Storage パス（.../thumb/{id}.webp） */
    thumbPath: string;
    /** 任意のキャプション。空文字は未設定 */
    caption: string;
    /** 表示順（昇順） */
    sortOrder: number;
    /** 代表写真フラグ。ログ内で高々 1 件 */
    isCover: boolean;
    width: number | null;
    height: number | null;
}

/** ダイブログの同行バディ（登録ユーザー or フリーテキスト）。spec 021 US1 */
export interface DiveBuddy {
    /** dive_log_buddies.id */
    id: string;
    /** 登録ユーザーのバディの場合の users.id。フリーテキストの場合は null */
    userId: string | null;
    /** 表示名（登録ユーザーは nickname、フリーテキストはそのテキスト） */
    name: string;
    /** 登録ユーザーのユーザー ID（034。プロフィールリンク生成用。フリーテキスト・退会時は null） */
    handle: string | null;
    /** 登録ユーザー由来か（true なら userId からプロフィールへ遷移可能） */
    isRegistered: boolean;
}

/** 表示用（署名 URL を解決済み）。ギャラリー / サムネイルに渡す */
export interface DivePhotoView {
    id: string;
    /** 表示用画像の署名 URL */
    displayUrl: string;
    /** サムネイルの署名 URL */
    thumbUrl: string;
    caption: string;
    isCover: boolean;
    width: number | null;
    height: number | null;
    /** alt 用の代替テキスト（caption 優先、無ければログ情報由来） */
    alt: string;
}
