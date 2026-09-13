import type { FormSelectOption } from '@/shared/components/form';
import type { PageMetadata } from '@/shared/config/metadata';

/** 問い合わせ種別の値（DB の CHECK 制約・submit_inquiry と同値） */
export const INQUIRY_CATEGORY_VALUES = ['question', 'bug', 'request', 'other'] as const;

/** フォームの種別セレクトの選択肢（値→表示ラベル） */
export const INQUIRY_CATEGORY_OPTIONS: ReadonlyArray<FormSelectOption> = [
    { value: 'question', label: 'ご質問' },
    { value: 'bug', label: '不具合報告' },
    { value: 'request', label: 'ご要望' },
    { value: 'other', label: 'その他' },
];

/** 入力上限（DB の CHECK 制約と同値に保つ） */
export const CONTACT_NAME_MAX_LENGTH = 100;
export const CONTACT_EMAIL_MAX_LENGTH = 254;
export const CONTACT_BODY_MAX_LENGTH = 1000;

// レート制限のしきい値（同一 IP 60 秒で 3 件 / 同一本文 5 分）は submit_inquiry 関数が真実。
// マイグレーション 20260629110000_create_inquiries.sql のコメントを参照（research R-002）。

export const PAGE_DATA: PageMetadata = {
    slug: '/contact',
    title: 'お問い合わせ',
    description: 'サービスへのご質問・ご要望・不具合のご連絡はこちらのフォームからお送りください。',
};

/** 送信完了（サンクス）ページのメタ情報 */
export const COMPLETE_PAGE_DATA: PageMetadata = {
    slug: '/contact/complete',
    title: 'お問い合わせ完了',
    description: 'お問い合わせを受け付けました。',
};

/** 送信完了後に遷移するサンクスページのパス */
export const CONTACT_COMPLETE_PATH = '/contact/complete';

/** 種別の値を表示ラベルに変換する（確認画面などで使用。未知の値はそのまま返す） */
export const inquiryCategoryLabel = (value: string): string =>
    INQUIRY_CATEGORY_OPTIONS.find((option) => option.value === value)?.label ?? value;
