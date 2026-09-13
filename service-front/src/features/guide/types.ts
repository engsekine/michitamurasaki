import type { Route } from 'next';

/**
 * 使い方ページのコンテンツ構造（030-usage-guide）。
 * DB には保存せず、constants.ts の GUIDE_SECTIONS がこの型に従う。
 */

/** 操作手順の 1 ステップ。テキストのみで手順が完結するよう body を書く（FR-009） */
export interface GuideStep {
    /** ステップの短い見出し */
    title: string;
    /** ステップの説明文 */
    body: string;
}

/** セクションから機能画面への導線（FR-004） */
export interface GuideLink {
    /** 遷移先のアプリ内ルート（typedRoutes で実在ルートに限定する） */
    href: Route;
    /** リンクラベル */
    label: string;
    /**
     * ログイン必須機能か。現状は描画で参照しないコンテンツ定義上のメタデータ
     * （未ログイン時の誘導は既存の認証ガードに委ねる）。将来、未ログイン閲覧時に
     * ラベルへ「要ログイン」注記等を出し分ける場合にこのフラグを使う
     */
    requiresAuth: boolean;
}

/** 使い方ページの 1 セクション。id は目次アンカー（#<id>）と見出しの id に使う */
export interface GuideSection {
    /** セクションの一意 id（kebab-case） */
    id: string;
    /** セクション見出し（h2） */
    title: string;
    /** セクションの導入文 */
    description: string;
    /** 操作手順（番号付きで描画する・FR-008） */
    steps: GuideStep[];
    /** 機能画面への導線 */
    links: GuideLink[];
}
