# Quickstart: ランディングページ（LP）の検証手順

**Feature**: [spec.md](./spec.md) | **Contract**: [contracts/routes.md](./contracts/routes.md)

## 前提

```bash
npm install          # モノレポルートで実行
npm run dev -w service-front   # http://localhost:3000
```

## 手動検証シナリオ

### 1. 未認証で LP が表示される（US1 / FR-001）

1. シークレットウィンドウで `http://localhost:3000/lp` を開く
2. ✅ ログイン画面へリダイレクトされず LP が表示される
3. ✅ ファーストビューにキャッチコピーと「無料で始める」等の登録 CTA がある
4. ✅ 最下部までスクロールすると 機能紹介（画像 4 点）→ 料金（お試し 480 円 / おすすめ 1,200 円 / たっぷり 3,000 円の 3 パック）→ CTA の順に表示される
5. ✅ ヒーローの CTA を押すと `/signup` に遷移する

### 2. 既存挙動の退行がない（US2 / FR-002）

1. シークレットウィンドウで `http://localhost:3000/` を開く → ✅ `/login` へリダイレクト
2. ログイン後 `http://localhost:3000/` を開く → ✅ ダッシュボード表示
3. ログイン済みのまま `/lp` を開く → ✅ LP がそのまま表示される（リダイレクトなし）

### 3. metadata / シェア表示（US3 / FR-009）

```bash
curl -s http://localhost:3000/lp | grep -E 'og:title|og:description|og:image|twitter:card|canonical'
```

✅ OG / Twitter / canonical(`/lp`) が出力され、`noindex` が**含まれない**こと。`/sitemap.xml` に `/lp` が含まれること。

### 4. モバイル表示（FR-010）

1. DevTools で 375px 幅にする
2. ✅ 横スクロールが発生しない・CTA が指で押せる大きさ（44px 以上）

## 自動テスト

```bash
# 単体テスト（features/landing 配下）
npx vitest run src/features/landing --root service-front

# Storybook（コンポーネント確認）
npm run storybook -w service-front

# a11y / ルーティング E2E（Playwright + axe-core）
npx playwright test tests/landing --config service-front/playwright.config.ts
```

✅ すべて green・axe の重大違反 0 件（SC-006）

## 注意（worktree で実行する場合)

worktree には `node_modules` が無く `@repo/*` がメインリポジトリ側に解決される既知の問題がある。vitest は `service-front` を cwd にして実行するか、メインリポジトリの `node_modules` への symlink で回避する。
