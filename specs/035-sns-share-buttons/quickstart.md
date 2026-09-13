# Quickstart: SNS 共有ボタン検証手順

**Date**: 2026-07-16 | **Feature**: [spec.md](./spec.md)

実装完了後に機能が end-to-end で動くことを確認する手順。設計詳細は [plan.md](./plan.md)・[contracts/sns-share-buttons.md](./contracts/sns-share-buttons.md) を参照。

## 前提

- ルート `.env.local` 設定済み・`make supabase-reset` 済み（seed のテストユーザーを使用）
- DB 変更はないため追加のマイグレーション・seed 作業は不要

```bash
npm run dev --workspace=service-front   # http://localhost:3000
```

## 手動検証

### 1. 公開ログの共有（US1）

1. `test@example.com` / `password123` でログイン
2. ログ一覧から任意のログを開き、公開設定を「公開」にする
3. ログ詳細に X・Facebook のアイコン付き共有ボタンが表示される（Instagram は 2026-07-16 改定で削除）
4. **X**: 新しいタブで x.com の投稿画面が開き、本文に「{場所}のダイビングログ（{日付}）| {サイト名}」とログの URL が入っている
5. **Facebook**: 新しいタブで共有ダイアログが開き、URL が `http://localhost:3000/dives/<id>` になっている（※ localhost の URL は Facebook 側のクロール検証で弾かれるため、投稿完了までの確認は公開ドメインの stg / prod で行う）
6. ログを非公開に戻す → 共有ボタンが表示されない
7. `buddy@example.com` / `password123` で別ブラウザからログインし、公開ログの URL を直接開く → 閲覧者にも共有ボタンが表示される

### 2. プロフィールの共有（US2）

1. ヘッダーからマイプロフィール（`/users/taro`）を開く → 共有ボタンが表示される
2. X ボタンで「{ニックネーム}のダイビングプロフィール | {サイト名}」とプロフィール URL 入りの投稿画面が開く
3. 他人のプロフィール（`/users/buddy-taro`）でも同様に表示・動作する

### 3. エッジケース

- 場所名に `#マンタ & 🐢` のような記号・絵文字を含むログで X 共有 → 投稿画面のテキストが欠落・文字化けしない

## 自動テスト

```bash
# 単体（新規 SnsShareButtons + 同期更新した DiveDetail）
npm run test --workspace=service-front -- SnsShareButtons DiveDetail

# a11y / e2e（webServer 設定により dev サーバーは自動起動。ローカル Supabase は要起動）
npx playwright test tests/sns-share.spec.ts --project=chromium
npx playwright test tests/a11y/dives-pages.spec.ts tests/a11y/social-pages.spec.ts --project=chromium

# 規約チェック
npx biome check .
```

## 期待される結果

- 上記手動検証がすべて成功シナリオどおり
- Vitest / Playwright すべて green、axe 違反 0 件（SC-004)
- 非公開ログで共有ボタンが出るケースが存在しない（SC-003)
