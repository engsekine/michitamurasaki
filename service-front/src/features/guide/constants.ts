import type { PageMetadata } from '@/shared/config/metadata';

import type { GuideSection } from './types';

/** 使い方ページの metadata（公開ページのため noIndex は付けない・FR-010） */
export const PAGE_DATA: PageMetadata = {
    slug: '/guide',
    title: '使い方',
    description: 'ダイビングログの記録から予定・持ち物の管理まで、アプリの使い方をステップ形式で紹介します',
};

/**
 * 使い方ページのセクション定義（spec 030 FR-002 の 6 セクション）。
 * 目次とセクション本文はこの配列から生成する（二重管理しない）。
 * 機能や文言の変更時はこの定義を実装に合わせて更新する（Living Document）。
 */
export const GUIDE_SECTIONS: GuideSection[] = [
    {
        id: 'getting-started',
        title: 'はじめに',
        description: '登録から最初のダイブログ作成まで、基本の流れを紹介します。',
        steps: [
            {
                title: 'アカウントを登録する',
                body: 'メールアドレスで無料登録できます。登録するとログ作成に使える無料のログ枠が付与されます。',
            },
            {
                title: 'プロフィールを設定する',
                body: '設定画面でニックネームや保有資格を登録すると、ログや公開プロフィールに反映されます。',
            },
            {
                title: '最初のダイブログを作成する',
                body: '「ログを作成」から日付・ポイント・最大深度・潜水時間などを入力して保存します。',
            },
            {
                title: 'ダッシュボードで確認する',
                body: '保存したログはトップページの統計（総ダイブ数・最大深度など）にすぐ反映されます。',
            },
        ],
        links: [
            { href: '/signup', label: '無料で登録する', requiresAuth: false },
            { href: '/dives/new', label: 'ログを作成する', requiresAuth: true },
        ],
    },
    {
        id: 'dive-logs',
        title: 'ダイブログを記録する',
        description: '潜った 1 本ごとの記録を作成・整理できます。',
        steps: [
            {
                title: 'ログを作成する',
                body: '日付・ダイビングポイント・最大深度・潜水時間・水温などを入力します。タンクや残圧を記録すると SAC（呼吸消費率）も自動計算されます。',
            },
            {
                title: '写真を添付する',
                body: '水中写真をログに添付して、思い出と一緒に保存できます。',
            },
            {
                title: '一覧から探す',
                body: 'ログ一覧ではキーワードや日付・ポイントで絞り込んで、過去のログをすぐに見つけられます。',
            },
        ],
        links: [
            { href: '/dives/new', label: 'ログを作成する', requiresAuth: true },
            { href: '/dives', label: 'ログ一覧を見る', requiresAuth: true },
        ],
    },
    {
        id: 'plans-packing',
        title: 'ダイビング予定と持ち物リスト',
        description: '次のダイビングの予定を立てて、持ち物の準備までまとめて管理できます。',
        steps: [
            {
                title: '予定を作成する',
                body: '日付と行き先を入力して予定を登録します。予定日までの残り日数や潮回りが自動で表示されます。',
            },
            {
                title: '持ち物リストで準備する',
                body: '予定ごとに持ち物リストを作成し、チェックしながら準備を進められます。準備の進捗はトップページにも表示されます。',
            },
            {
                title: '当日になったらログに記録する',
                body: '予定日を迎えると「ログに記録する」ボタンが表示され、予定の内容を引き継いでログを作成できます。',
            },
        ],
        links: [
            { href: '/plans/new', label: '予定を作成する', requiresAuth: true },
            { href: '/plans', label: '予定一覧を見る', requiresAuth: true },
        ],
    },
    {
        id: 'dashboard',
        title: 'ダッシュボードで振り返る',
        description: 'トップページで、これまでのダイビングの記録をひと目で振り返れます。',
        steps: [
            {
                title: '累計の統計を確認する',
                body: '総ダイブ数・今年のダイブ数・最大深度・前回からのブランク日数をトップページで確認できます。',
            },
            {
                title: '推移をチャートで見る',
                body: '年別のダイブ本数や月別の平均水温など、記録の推移をチャートで確認できます。',
            },
            {
                title: '機材のメンテナンス時期を管理する',
                body: 'レギュレーターを登録すると、オーバーホール（OH）の推奨時期をトップページでお知らせします。',
            },
        ],
        links: [
            { href: '/', label: 'ダッシュボードを開く', requiresAuth: true },
            { href: '/settings/equipment', label: '機材を登録する', requiresAuth: true },
        ],
    },
    {
        id: 'social-likes',
        title: 'みんなのログ・いいね',
        description: 'ほかのダイバーのログを見て、いいねで気持ちを伝えられます。',
        steps: [
            {
                title: 'タイムラインを見る',
                body: 'トップページのタイムラインに、フォローしているダイバーやみんなのログが流れます。',
            },
            {
                title: 'いいねで反応する',
                body: '気になったログにはいいねを付けられます。いいねはログの作成者に通知されます。',
            },
            {
                title: 'いいねしたログを見返す',
                body: 'いいねしたログは一覧ページからいつでも見返せます。',
            },
        ],
        links: [{ href: '/likes', label: 'いいねしたログを見る', requiresAuth: true }],
    },
    {
        id: 'log-credits',
        title: 'ログ枠と追加購入',
        description: 'ログの作成には「ログ枠」を 1 件につき 1 枠使います。枠の仕組みと増やし方を紹介します。',
        steps: [
            {
                title: '無料のログ枠から始める',
                body: '登録時に無料のログ枠が付与され、そのままログを作成できます。ログを 1 件作成するごとに 1 枠を消費します。',
            },
            {
                title: '毎日のボーナスで枠が増える',
                body: 'アプリを利用すると、デイリーボーナスとしてログ枠が毎日 1 枠ずつ付与されます。',
            },
            {
                title: '足りなくなったらログパックを購入する',
                body: '残りのログ枠は設定画面でいつでも確認できます。枠が足りなくなったら、ログパック（10 / 30 / 100 枠）を購入して追加できます。',
            },
        ],
        links: [{ href: '/settings/log-credits', label: 'ログ枠を確認・購入する', requiresAuth: true }],
    },
];
