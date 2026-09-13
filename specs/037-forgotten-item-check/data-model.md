# Data Model: 忘れ物確認機能

**Date**: 2026-08-07 | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

新規テーブルはなし。既存 2 テーブルへカラムを追加する（[004 data-model](../004-top-dive-plans/data-model.md) の拡張）。

## dive_plans（カラム追加）

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| packing_completed_at | timestamptz | nullable | 持ち物準備の完了日時。null = 未完了。値あり = 完了中（忘れ物確認リストを表示） |

- 完了操作（`completePacking`）で `now()` を設定、解除（`uncompletePacking`）で null に戻す
- 予定ごとに独立（FR-004）。既存の `updated_at` トリガーで更新日時は自動管理

## plan_packing_items（カラム追加）

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| is_confirmed | boolean | not null default false | 忘れ物確認（2 周目チェック）の確認状態。準備チェック `is_checked` とは独立 |

- default false のため、完了後に追加された項目は自動的に「未確認」で忘れ物確認リストに現れる（FR-008）
- 項目削除は既存の `on delete cascade` / 行削除にそのまま従う

## 状態遷移

```text
未完了（packing_completed_at = null）
    │ completePacking()            ※持ち物 0 件・終了済み予定では不可（FR-007/FR-009）
    ▼
完了中（packing_completed_at = now()）
    │  - toggleConfirmItem() で項目ごとに is_confirmed を切替（FR-006）
    │  - 項目追加 → is_confirmed = false で確認対象に加わる（FR-008）
    │ uncompletePacking()
    ▼
未完了に戻る
    - packing_completed_at = null
    - 該当予定の全項目 is_confirmed = false（確認状態は破棄 / Clarifications Q1）
    - is_checked（準備チェック）は変更しない（FR-005）
```

## RLS / セキュリティ

- 追加ポリシーなし。既存の dive_plans / plan_packing_items の「本人のみ select / insert / update / delete」ポリシーがカラム追加後もそのまま適用される
- Server Actions 側でも予定の所有チェック + FR-007 / FR-009 のガードを行う（[contracts/server-actions.md](./contracts/server-actions.md)）

## マイグレーション

```text
supabase/migrations/<timestamp>_add_packing_completion.sql
```

- `alter table public.dive_plans add column packing_completed_at timestamptz;`
- `alter table public.plan_packing_items add column is_confirmed boolean not null default false;`
- 各カラムに `comment on column` で意図を記載（sql.md 規約）
- 既存データへの影響: 全予定が「未完了」・全項目が「未確認」で開始（backfill 不要）

## アプリケーション型への反映

| 型 | 追加フィールド |
|---|---|
| `PackingItem`（features/plans/types.ts） | `isConfirmed: boolean` |
| `NextPlanSummary` / `PlanWithPacking` | `packingCompletedAt: string \| null` |
| `packages/supabase/src/types.ts` | Supabase 型定義の再生成で追従 |
