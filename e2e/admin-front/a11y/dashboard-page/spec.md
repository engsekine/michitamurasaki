# dashboard-page（E2E 仕様）

## 目的

管理画面（admin-front）の認証後ページが WCAG 2.1 AA に違反していないことを守る。ダッシュボードと主要な一覧ページを axe-core でスキャンし、リグレッションを検知する。

## 対象

- アプリ: admin-front（http://localhost:9324）
- 画面 / URL: `/`（ダッシュボード）、`/users`、`/dives`、`/dive-sites`、`/inquiries`、`/audit-logs`
- 関連仕様: `specs/015-admin-panel/spec.md`（WCAG 2.1 AA 準拠は `rules/accessibility.md` と揃える）

## 前提

- 認証: ログイン済み（setup project の storageState・superadmin）
- Cookie 同意: プリセットなし（cookieConsent: 'unset'）
- データ: seed のみ
- その他: 各ページとも h1 の表示を待ち、`networkidle` 到達後に axe（タグ `wcag2a` / `wcag2aa` / `wcag21a` / `wcag21aa`）でスキャンする

## シナリオ

| # | テスト名 | 検証内容 |
|---|---|---|
| 1 | / - WCAG 2.1 AA 違反なし | `/` を開き h1「ダッシュボード」の表示を待ってから axe を実行し、violations が空であることを assert する |
| 2 | /users - WCAG 2.1 AA 違反なし | `/users` を開き h1「ユーザー」の表示を待ってから axe を実行し、violations が空であることを assert する |
| 3 | /dives - WCAG 2.1 AA 違反なし | `/dives` を開き h1「ダイブログ」の表示を待ってから axe を実行し、violations が空であることを assert する |
| 4 | /dive-sites - WCAG 2.1 AA 違反なし | `/dive-sites` を開き h1「ダイブサイト」の表示を待ってから axe を実行し、violations が空であることを assert する |
| 5 | /inquiries - WCAG 2.1 AA 違反なし | `/inquiries` を開き h1「お問い合わせ」の表示を待ってから axe を実行し、violations が空であることを assert する |
| 6 | /audit-logs - WCAG 2.1 AA 違反なし | `/audit-logs` を開き h1「操作ログ」の表示を待ってから axe を実行し、violations が空であることを assert する |

## 備考

- テストは `AUTHENTICATED_PAGES` 配列の `for` ループで生成しており、テスト名は `${path} - WCAG 2.1 AA 違反なし` の形式
- dev サーバーはオンデマンド配信のため、JS チャンク取得が落ち着く `networkidle` を待ってからスキャンする（ハイドレーション前の DOM を誤検知しない）
- Cookie 同意バナーの有無を含めて検証するため、fixture 既定の同意済みプリセットを打ち消している
