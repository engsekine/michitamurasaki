import type { PageMetadata } from '@/shared/config/metadata';

/** LP（`/lp`）のメタ情報。noIndex は付けず検索インデックスを許可する（031 / FR-009） */
export const PAGE_DATA: PageMetadata = {
    slug: '/lp',
    title: 'ダイビングのすべてを 1 冊に',
    description:
        'ダイビングログの記録・累計統計・次の予定の管理・仲間とのタイムライン共有まで。あなたのダイビングライフをまるごと残せる無料のログブックサービスです。',
};

/** ヒーローのキャッチコピー（FR-003） */
export const HERO_COPY = {
    /** 目立たせる主見出し */
    title: 'ダイビングのすべてを、1 冊に。',
    /** 主見出しを補う説明文 */
    description:
        'もぐった記録も、次の予定も、仲間とのつながりも。紙のログブックの手間なく、スマホひとつでダイビングライフを残せます。',
    /** 主要 CTA のラベル */
    primaryCtaLabel: '無料ではじめる',
    /** ログイン導線のラベル */
    loginLabel: 'ログインはこちら',
} as const;

/** 最下部 CTA のコピー（FR-006） */
export const CTA_COPY = {
    title: '今日のダイビングから、記録をはじめよう。',
    description: '登録は無料。初回にログ枠が付与されるので、すぐに 1 本目を記録できます。',
    primaryCtaLabel: '無料ではじめる',
} as const;

/** 機能紹介 1 件の型（FR-004 / FR-004a） */
export interface LandingFeature {
    /** 機能名 */
    title: string;
    /** 1〜2 文の説明 */
    description: string;
    /** スクリーンショットのパス（`/lp/` 配下） */
    imageSrc: string;
    /** 画像の内容を説明する代替テキスト（装飾扱いにしない / a11y） */
    imageAlt: string;
}

/** 主要機能の紹介 4 件（spec: 機能紹介セクション） */
export const LANDING_FEATURES: ReadonlyArray<LandingFeature> = [
    {
        title: 'ダイビングログの記録',
        description:
            '潜水日・ポイント・最大深度・潜水時間などをかんたんに記録。1 本ごとのログが自動で 1 冊に積み上がります。',
        imageSrc: '/lp/dive-log.png',
        imageAlt: 'ダイビングログの入力画面。潜水日やポイント、最大深度などを入力しているようす',
    },
    {
        title: '累計統計ダッシュボード',
        description:
            '総ダイブ数・今年の本数・最大深度・ブランク日数を自動集計。あなたのダイビングの歩みがひと目でわかります。',
        imageSrc: '/lp/dashboard.png',
        imageAlt: 'ダッシュボード画面。総ダイブ数や最大深度などの統計と推移グラフが並んでいるようす',
    },
    {
        title: '次のダイビング予定の管理',
        description: '次に潜る予定を登録して、当日までの残り日数を確認。持ち物の準備も予定に紐づけて管理できます。',
        imageSrc: '/lp/plans.png',
        imageAlt: 'ダイビング予定の一覧画面。行き先と残り日数のカードが並んでいるようす',
    },
    {
        title: '仲間とのタイムライン共有',
        description:
            'フォローしたバディのログがタイムラインに流れます。お互いのダイビングにいいねを送りあって楽しめます。',
        imageSrc: '/lp/timeline.png',
        imageAlt: '仲間のダイビングログが時系列で並ぶタイムライン画面のようす',
    },
];
