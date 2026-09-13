# Quickstart: アプリの使い方ページの検証

**Date**: 2026-07-08 | **Plan**: [plan.md](./plan.md)

実装後に機能が end-to-end で動くことを確認する手順。契約の詳細は [contracts/guide-page.md](./contracts/guide-page.md)、セクション構成は [data-model.md](./data-model.md) を参照。

## 前提

- リポジトリルートで `npm install` 済み
- 実装ブランチに最新 main を取り込み済み（plan.md「実装上の注意」参照）

## 1. 開発サーバーでの手動検証

```bash
npm run dev --workspace=service-front
# http://localhost:3000
```

| # | 手順 | 期待結果 | 対応 FR |
|---|---|---|---|
| 1 | シークレットウィンドウ（未ログイン）で `http://localhost:3000/guide` を開く | ログイン画面にリダイレクトされず 200 で表示 | FR-001 |
| 2 | ページを確認 | h1「使い方」+ 目次 + 6 セクション（はじめに / ログ記録 / 予定・持ち物 / ダッシュボード / いいね / ログ枠）が表示 | FR-002 |
| 3 | 目次の任意の項目をクリック | 該当セクションの先頭へスクロール（URL に `#<id>` が付く） | FR-003 |
| 4 | 各セクションの導線リンクを確認 | 全セクションに機能画面への導線がある。未ログインでログイン必須先を押すとログイン画面へ | FR-004 |
| 5 | 登録導線（`/signup` リンク）をクリック | 新規登録画面に遷移 | FR-005 |
| 6 | 任意のページのヘッダー / フッターを確認 | 「使い方」リンクが両方にあり `/guide` へ遷移（モバイル幅ではメニュー内） | FR-006 |
| 7 | ビューポートをモバイル幅（375px）にする | 横スクロールなしで全セクション閲覧可 | SC-004 |
| 8 | ブラウザの表示ソースで `robots` を確認 | `noindex` が**含まれない** | FR-010 |
| 9 | ログイン済み状態で `/guide` を開く | 同一コンテンツが表示される | FR-001 |

## 2. 自動テスト

```bash
# 単体テスト（GuideView / GuideSectionCard / Header / Footer。service-front で実行）
cd service-front
npx vitest run --project=unit src/features/guide src/shared/components/layout

# a11y / E2E テスト（Playwright + axe。dev サーバー自動起動・ローカル Supabase 必須）
npx playwright test tests/a11y/guide.spec.ts
```

期待結果:

- Vitest: 全件パス（目次とセクションの対応・手順の番号付きリスト・導線リンク・「使い方」ナビ項目）
- Playwright: 6 件パス（未ログイン表示 + axe 違反 0 / noindex なし / 登録導線 / ログイン済み表示 / モバイル横スクロールなし / 目次アンカー）

手動検証 9 手順は上記の自動テストですべてカバーされる（手順 1→E2E 未ログイン表示、2→6 セクション、3→目次、4→unit 導線 + E2E、5→E2E 登録導線、6→Header / Footer unit、7→E2E SC-004、8→E2E noindex、9→E2E ログイン済み表示）。

## 3. リグレッション確認

```bash
npx biome check service-front/src
npx tsc --noEmit -p service-front
```

- proxy.ts を変更していないこと（`/guide` はホワイトリスト方式で素通し）
- 既存の Header / Footer テストが更新済みでパスすること
