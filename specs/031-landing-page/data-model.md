# Data Model: ランディングページ（LP）

**Date**: 2026-07-08 | **Feature**: [spec.md](./spec.md)

## データベース

**変更なし。** LP は静的な紹介コンテンツのみで構成され、テーブル追加・カラム変更・マイグレーション・RLS ポリシーはすべて不要（spec: Key Entities 参照）。

## コンテンツモデル（TypeScript 定数の形）

DB エンティティの代わりに、`features/landing/constants.ts` で管理する静的コンテンツの構造を定義する。

### PAGE_DATA（metadata / sitemap 用）

既存の `PageMetadata` 型（`@/shared/config/metadata`）に従う。

| フィールド | 値 | 備考 |
|-----------|----|------|
| `slug` | `/lp` | canonical・sitemap の URL |
| `title` | LP のページタイトル | `%s | サイト名` テンプレートに入る |
| `description` | 検索・SNS 向け紹介文 | OG / twitter description に展開 |

### LandingFeature（機能紹介 1 件）

| フィールド | 型 | 制約 | 備考 |
|-----------|----|------|------|
| `title` | `string` | 必須 | 機能名（例: ダイビングログの記録） |
| `description` | `string` | 必須 | 1〜2 文の説明 |
| `imageSrc` | `string` | 必須・`/lp/` 配下 | スクリーンショットのパス |
| `imageAlt` | `string` | 必須・内容を説明する文 | a11y（FR-011）。装飾扱いにしない |

紹介する機能は 4 件（FR-004）: ダイビングログの記録 / 統計ダッシュボード / ダイビング予定の管理 / 仲間とのタイムライン共有。

### LandingPricingProps（料金セクションへの注入値）

ハードコード禁止。`page.tsx`（app 層）が `features/credits` の定数から組み立てて注入する（feature 間 import 回避）。

| フィールド | 型 | 供給元（唯一の情報源） |
|-----------|----|----------------------|
| `packs` | `readonly LandingPricingPack[]` | `LOG_CREDIT_PACKS`（quantity / amountJpy / displayName / discountLabel / isRecommended の 3 パック） |
| `initialGrantAmount` | `number` | `INITIAL_GRANT_AMOUNT`（= 10） |
| `dailyBonusAmount` | `number` | `DAILY_BONUS_AMOUNT`（= 1） |

### 遷移先（リンク定義）

| 導線 | 遷移先 | 対応 FR |
|------|--------|---------|
| 主要 CTA（ヒーロー・最下部） | `/signup` | FR-003・FR-006 |
| ログイン導線 | `/login` | FR-007（Header の AuthNav も常時提供） |
| 利用規約 / プライバシーポリシー / お問い合わせ | `/terms` / `/privacy-policy` / `/contact` | FR-008（既存 Footer が提供） |
