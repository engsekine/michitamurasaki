# landing（E2E 仕様）

## 目的

ランディングページは未認証の訪問者が最初に触れる入口で、認証ガードに巻き込まれて表示できない・CTA が登録に繋がらない・メタ情報が欠けて検索/SNS に載らない、のいずれも直接ユーザー獲得を損なう。`/lp` の公開性・登録導線・既存挙動の不変・メタ/サイトマップ・モバイル表示を実ブラウザで守る。

## 対象

- アプリ: service-front（http://localhost:9323）
- 画面 / URL: `/lp`、`/signup`（CTA 遷移先）、`/`（未認証リダイレクトの退行確認）、`/login`、`/sitemap.xml`
- 関連仕様: `specs/031-landing-page/spec.md`（FR-001 公開 URL、FR-002 既存挙動不変、FR-003 CTA、FR-007 ログイン導線、FR-009 メタ情報、FR-010 モバイル/タッチターゲット、SC-006 a11y。US1〜US3、quickstart.md）

## 前提

- 認証: 未認証（NO_AUTH）。シナリオ 4 のみテスト内で `SERVICE_USER`（test@example.com）にログイン
- Cookie 同意: 同意済みプリセット（fixture 既定）
- データ: seed のみ（`SERVICE_USER`）
- その他: シナリオ 7・8 は `page.setViewportSize({ width: 375, height: 667 })` でモバイル幅に変更

## シナリオ

| # | テスト名 | 検証内容 |
|---|---|---|
| 1 | 未認証で /lp が表示され、CTA から /signup へ遷移できる | `/lp` が 200 で返り URL が `/lp` のまま（リダイレクトなし）。h1 が 1 つだけ。「無料ではじめる」リンクが 2 つ以上あり全て `href="/signup"`、「ログインはこちら」が `/login` を指す。CTA クリックで `/signup` に遷移する。 |
| 2 | /lp - WCAG 2.1 AA 違反なし | `/lp` を開き networkidle 後に `expectNoViolations` で axe 違反 0 件を assert する。 |
| 3 | 未認証でトップにアクセスするとログイン画面へリダイレクトされる | 未認証で `/` を開くと `/login` に遷移することを assert する（既存挙動の退行防止）。 |
| 4 | 認証済みでも /lp はリダイレクトされずそのまま閲覧できる | `SERVICE_USER` でログイン後 `/lp` を開くと 200・URL `/lp` のまま・h1 が 1 つであることを assert する。 |
| 5 | /lp に OG・Twitter・canonical メタが設定され noindex を含まない | `og:title` / `og:description` / `og:image` / `twitter:card` が各 1 つ、`link[rel=canonical]` の href が `/lp` で終わる。`meta[name=robots]` があれば `noindex` を含まないことを assert する。 |
| 6 | sitemap.xml に /lp が含まれる | `/sitemap.xml` のレスポンス本文に `/lp` が含まれることを assert する。 |
| 7 | モバイル幅（375px）で横スクロールが発生しない | 375×667 で `/lp` を開き、`document.documentElement.scrollWidth <= window.innerWidth` であることを assert する。 |
| 8 | 主要 CTA のタッチターゲットが 44px 以上ある | 375×667 で「無料ではじめる」の先頭リンクの `boundingBox` 高さが 44px 以上であることを assert する。 |

## 備考

- a11y の全ページスイープは a11y の公開ページ spec が `/lp` も含めて担保するが、SC-006 のトレーサビリティのため本ファイルでも `/lp` 単体の axe スキャンを持つ
- `meta[name=robots]` は存在しない場合もあるため、存在するときのみ `noindex` 不在を assert する条件付き検証になっている
