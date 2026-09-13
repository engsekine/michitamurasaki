import type { PageMetadata } from '@/shared/config/metadata';

/** ショップ一覧ページの metadata（個人データを扱う認証ページ） */
export const PAGE_DATA: PageMetadata = {
    slug: '/shops',
    title: 'ショップ',
    description: '行きつけのダイビングショップを登録して、予定・ログ・申し込みシートと紐付けて管理できます',
};

/** 入力上限（DB の check 制約と同期: supabase/migrations の create_dive_shops） */
export const SHOP_NAME_MAX_LENGTH = 120;
export const SHOP_ADDRESS_MAX_LENGTH = 255;
export const SHOP_PHONE_MAX_LENGTH = 20;
export const SHOP_WEBSITE_URL_MAX_LENGTH = 2048;
export const SHOP_MEMO_MAX_LENGTH = 1000;

/** 住所から位置を特定できない・地図を利用できないときの表示文言（FR-013） */
export const MAP_UNAVAILABLE_MESSAGE = '住所から地図を表示できません。住所の内容をご確認ください';

/** 予定・ログ・シートのショップ選択欄で未選択を表すラベル */
export const SHOP_UNSELECTED_LABEL = '選択しない';
