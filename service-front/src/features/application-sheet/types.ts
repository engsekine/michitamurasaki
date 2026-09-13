import type { Database } from '@repo/supabase';

/** 有無系ラジオの値。'' = 未選択（出力は空欄のまま） */
export type YesNoValue = '' | 'yes' | 'no';

/** 性別の選択値。'' = 未選択（`unanswered` 相当・出力は空欄） */
export type SheetGenderValue = '' | 'male' | 'female';

/** コンタクトレンズの種類（DB CHECK 制約の 3 値と同期。'' = 未選択） */
export type ContactLensTypeValue = '' | 'hard' | 'soft' | 'disposable';

/** レンタル品目のキー（14 種）。表示順・ラベルは constants の RENTAL_ITEMS が正 */
export type RentalItemKey =
    | 'wetSuitFullSet'
    | 'drySuitFullSet'
    | 'maskSnorkel'
    | 'fin'
    | 'glove'
    | 'boots'
    | 'wetSuit'
    | 'wetVest'
    | 'drySuit'
    | 'bc'
    | 'regulator'
    | 'diveComputer'
    | 'underwaterLight'
    | 'underwaterCamera';

/**
 * 申し込みシートフォームの入力値。
 * 全項目任意（FR-005）。数値系は入力欄の文字列のまま保持し、buildSheetText で整形する。
 */
export interface SheetFormValues {
    fullName: string;
    /** 年齢（数字文字列） */
    age: string;
    /** 生年月日（YYYY-MM-DD） */
    birthOn: string;
    gender: SheetGenderValue;
    phone: string;
    emergencyContactRelation: string;
    emergencyContactPhone: string;
    nearestStation: string;
    licenseRank: string;
    /** 経験本数（数字文字列） */
    diveCount: string;
    /** 最終ダイブ年月（表示形式「2026年7月」。DB では YYYY-MM で保持） */
    lastDiveYearMonth: string;
    hasDrySuitExperience: YesNoValue;
    /** ドライスーツの経験本数 約（数字文字列） */
    drySuitDiveCount: string;
    /** レンタル器材の有無 */
    hasRental: YesNoValue;
    rentalItems: RentalItemKey[];
    /** レンタル「無」時に品目〜サイズ欄ブロックを出力から省略する（FR-012。保存対象外） */
    omitRentalBlock: boolean;
    heightCm: string;
    weightKg: string;
    footSizeCm: string;
    hasContactLens: YesNoValue;
    contactLensType: ContactLensTypeValue;
    /** 度付きマスクレンタルの要否（yes = 要 / no = 不要） */
    needsPrescriptionMask: YesNoValue;
    /** 宛先ショップ（033）。'' = 未選択。保存時に null へ変換する */
    diveShopId: string;
}

export type ApplicationSheetRow = Database['public']['Tables']['application_sheets']['Row'];

/** 保存済みシートの一覧表示用サマリー */
export interface SavedSheetSummary {
    id: string;
    name: string;
    /** timestamptz（ISO 文字列） */
    updatedAt: string;
}

/** 保存済みシート 1 件（フォーム全体のスナップショット） */
export interface SavedApplicationSheet {
    id: string;
    name: string;
    values: SheetFormValues;
}

/**
 * 自動入力データ（FR-007）。未登録のソースは null（FR-009）。
 * 新規シート作成時の初期値にのみ使う（保存済みシートはスナップショットをそのまま復元する）。
 * gender は `unanswered` を null に落とす（空欄扱い）。
 */
export interface SheetPrefill {
    fullName: string | null;
    /** YYYY-MM-DD */
    birthOn: string | null;
    /** 生年月日から算出した年齢（JST 基準） */
    age: number | null;
    gender: 'male' | 'female' | null;
    heightCm: number | null;
    weightKg: number | null;
    licenseRank: string | null;
    diveCount: number | null;
    /** YYYY-MM */
    lastDiveYearMonth: string | null;
    /** 以下は保存済みの基本情報（application_sheets の kind='base' 行）由来。未保存は null */
    phone: string | null;
    emergencyContactRelation: string | null;
    emergencyContactPhone: string | null;
    nearestStation: string | null;
    hasDrySuitExperience: boolean | null;
    drySuitDiveCount: number | null;
}
