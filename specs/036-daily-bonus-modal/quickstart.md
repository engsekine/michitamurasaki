# Quickstart: デイリーボーナス獲得モーダル検証手順

**Date**: 2026-07-17 | **Feature**: [spec.md](./spec.md)

設計詳細は [plan.md](./plan.md)・[contracts/daily-bonus-modal.md](./contracts/daily-bonus-modal.md) を参照。

## 前提

マイグレーション + シード変更を含むため **`make supabase-reset` が必須**（`bonus@example.com` の投入と既存ユーザーへの当日分事前付与が行われる）。

```bash
make supabase-reset
npm run dev --workspace=service-front   # http://localhost:3000
```

## 手動検証

### 1. 獲得モーダルの表示（US1）

1. `bonus@example.com` / `password123` でログイン（当日分未付与のユーザー）
2. ログ一覧（`/dives`）など認証必須ページへ移動すると「デイリーボーナス獲得！」モーダルが表示され、「ログ枠が 1 つ増えました」と残り枠数が見える（付与は認証必須ページへの当日初アクセスで発生。TOP `/` は対象外）
3. Esc キーまたは閉じるボタンで閉じられ、元のページが操作できる
4. ハードリロードする → モーダルは再表示されない（当日分は付与済みのため）
5. 別ページへ遷移して戻る → 再表示されない

### 2. ログ作成への導線（US2）

1. （db reset 後に）`bonus@example.com` で再度検証する場合はモーダル表示時に「ログを書く」を押す
2. `/dives/new` に遷移し、モーダルは閉じている

### 3. 既存ユーザーに影響がないこと

1. `test@example.com` / `password123` でログインして `/dives` を開く → モーダルは表示されない（seed で当日分事前付与済み）
2. ページ表示・操作が従来どおりであること

### 4. 再検証したいとき

同日中の再検証は `make supabase-reset` で ledger を初期化してから行う（`bonus@example.com` の当日分が未付与状態に戻る）。

## 自動テスト

```bash
# DB 統合（返り値 true/false）+ コンポーネント単体
cd service-front
npx vitest run src/features/credits

# E2E（webServer 自動起動。ローカル Supabase は要起動 + reset 直後であること）
npx playwright test tests/daily-bonus-modal.spec.ts --project=chromium

# 規約チェック
npx biome check .
```

## 期待される結果

- 上記手動検証がすべて成功シナリオどおり
- Vitest / Playwright すべて green、モーダル表示状態の axe 違反 0 件（SC-003）
- 既存 E2E スイート（social-flows / a11y ほか）が引き続き green（SC-002 / シード事前付与の効果）
