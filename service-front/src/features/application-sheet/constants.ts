import type { PageMetadata } from '@/shared/config/metadata';

import type { ContactLensTypeValue, RentalItemKey, SheetGenderValue, YesNoValue } from './types';

/** 申し込みシートページの metadata（個人情報を扱う認証ページのため noIndex で使う） */
export const PAGE_DATA: PageMetadata = {
    slug: '/application-sheet',
    title: '申し込みシート',
    description: 'ダイビングショップへの申し込みに使う定型テキストをフォーム入力から生成してコピーできます',
};

/**
 * レンタル品目（14 種）。並び順・ラベルは出力テキスト契約と同期する（FR-003 / SC-002）。
 * buildSheetText とフォームの両方がこの配列を唯一の情報源とする。
 */
export const RENTAL_ITEMS: ReadonlyArray<{ key: RentalItemKey; label: string }> = [
    { key: 'wetSuitFullSet', label: 'ウエットスーツフルセット' },
    { key: 'drySuitFullSet', label: 'ドライスーツフルセット' },
    { key: 'maskSnorkel', label: 'マスク スノーケル' },
    { key: 'fin', label: 'フィン' },
    { key: 'glove', label: 'グローブ' },
    { key: 'boots', label: 'ブーツ' },
    { key: 'wetSuit', label: 'ウエットスーツ' },
    { key: 'wetVest', label: 'ウエットベスト' },
    { key: 'drySuit', label: 'ドライスーツ' },
    { key: 'bc', label: 'BC' },
    { key: 'regulator', label: 'レギュレーター' },
    { key: 'diveComputer', label: 'ダイビングコンピューター' },
    { key: 'underwaterLight', label: '水中ライト' },
    { key: 'underwaterCamera', label: '水中カメラ' },
];

/** レンタル品目キーの一覧（スキーマの oneOf 用） */
export const RENTAL_ITEM_KEYS = RENTAL_ITEMS.map((item) => item.key);

/** 有無ラジオの選択肢 */
export const YES_NO_OPTIONS: ReadonlyArray<{ value: Exclude<YesNoValue, ''>; label: string }> = [
    { value: 'yes', label: '有' },
    { value: 'no', label: '無' },
];

/** 度付きマスクレンタルの選択肢（yes = 要 / no = 不要） */
export const NEEDS_MASK_OPTIONS: ReadonlyArray<{ value: Exclude<YesNoValue, ''>; label: string }> = [
    { value: 'yes', label: '要' },
    { value: 'no', label: '不要' },
];

/** 性別の選択肢（出力テキストの表記と同期） */
export const SHEET_GENDER_OPTIONS: ReadonlyArray<{ value: Exclude<SheetGenderValue, ''>; label: string }> = [
    { value: 'male', label: '男性' },
    { value: 'female', label: '女性' },
];

/** コンタクトレンズ種類の選択肢（DB CHECK 制約と同期） */
export const CONTACT_LENS_TYPE_OPTIONS: ReadonlyArray<{ value: Exclude<ContactLensTypeValue, ''>; label: string }> = [
    { value: 'hard', label: 'ハード' },
    { value: 'soft', label: 'ソフト' },
    { value: 'disposable', label: '使い捨て' },
];

/** 氏名の最大文字数 */
export const FULL_NAME_MAX_LENGTH = 60;

/** 電話番号の最大文字数（DB CHECK 制約と同期） */
export const PHONE_MAX_LENGTH = 20;

/** 緊急連絡先の続柄の最大文字数（DB CHECK 制約と同期） */
export const EMERGENCY_CONTACT_RELATION_MAX_LENGTH = 40;

/** 最寄りの駅の最大文字数（DB CHECK 制約と同期） */
export const NEAREST_STATION_MAX_LENGTH = 100;

/** ライセンスランクの最大文字数（certifications.rank の CHECK 制約と同期） */
export const LICENSE_RANK_MAX_LENGTH = 60;

/** 足のサイズの上限（cm。DB CHECK 制約と同期） */
export const MAX_FOOT_SIZE_CM = 50;

/** シート名の最大文字数（DB CHECK 制約と同期） */
export const SHEET_NAME_MAX_LENGTH = 50;

/** 1 ユーザーが保存できるシートの上限件数（無制限な行増加を防ぐアプリ側の制限） */
export const MAX_APPLICATION_SHEETS = 20;

/** 基本情報（kind='base' 行）の固定シート名（一覧には表示しない） */
export const BASE_PROFILE_SHEET_NAME = '基本情報';
