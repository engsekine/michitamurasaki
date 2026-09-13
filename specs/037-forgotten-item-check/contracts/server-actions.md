# Contracts: Server Actions（忘れ物確認機能）

**Date**: 2026-08-07 | **Plan**: [../plan.md](../plan.md)

`service-front/src/features/plans/server/actions.ts` に追加する 3 つの Server Action。戻り値は既存 actions と同じ `ActionResult`（`{ success: true, data? } | { success: false, error }`）に統一する。

## completePacking

持ち物準備を完了にし、忘れ物確認フェーズへ移行する（FR-001〜FR-003）。

| 項目 | 内容 |
|---|---|
| 入力 | `planId: string`（uuid） |
| 出力 | `ActionResult` |
| 効果 | `dive_plans.packing_completed_at = now()` |

**検証（順に評価。違反時は success: false + 日本語エラーメッセージ）**:
1. 認証済みで、予定が本人所有であること（RLS + 明示チェック）
2. 予定日が今日以降であること（終了済み予定は不可 / FR-009）
3. 持ち物が 1 件以上あること（FR-007）
4. 未完了であること（二重完了は冪等に成功扱いでもよいが、状態は変えない）

準備チェック（is_checked）の状態は問わない（未チェックが残っていても完了できる / FR-002）。

## uncompletePacking

完了を解除し、通常の持ち物リストへ戻す（FR-005）。

| 項目 | 内容 |
|---|---|
| 入力 | `planId: string`（uuid） |
| 出力 | `ActionResult` |
| 効果 | `dive_plans.packing_completed_at = null` + 該当予定の全 `plan_packing_items.is_confirmed = false` |

**検証**:
1. 認証済みで、予定が本人所有であること
2. 完了中であること（未完了への解除は冪等に成功扱い）
3. `is_checked`（準備チェック）は変更しない

## toggleConfirmItem

忘れ物確認リストの項目の確認状態を切り替える（FR-006）。

| 項目 | 内容 |
|---|---|
| 入力 | `itemId: string`（uuid）, `isConfirmed: boolean` |
| 出力 | `ActionResult` |
| 効果 | `plan_packing_items.is_confirmed = isConfirmed` |

**検証**:
1. 認証済みで、項目の親予定が本人所有であること
2. 親予定が完了中であること（未完了時の確認操作は不可）
3. 親予定の予定日が今日以降であること（FR-009）

## クエリ拡張（contracts 扱いではないが同時変更）

- `listNextPlansWithProgress` / `getPlan`: select に `packing_completed_at` / `plan_packing_items.is_confirmed` を追加し、`NextPlanSummary.packingCompletedAt` / `PackingItem.isConfirmed` へマップする
