# Data Model: ダイビング予定をログへ移動

## スキーマ変更: なし

本フィーチャーは **新規テーブル・新規カラム・マイグレーションを一切追加しない**。移動は既存テーブルへの操作の組み合わせで完結する。

| テーブル | 定義元 | 本機能での操作 |
|---|---|---|
| `public.dives` | [002-dive-log-crud/data-model.md](../002-dive-log-crud/data-model.md) | **insert**（引き継ぎ値 + ユーザー入力で新規ログを作成） |
| `public.dive_plans` | [004-top-dive-plans/data-model.md](../004-top-dive-plans/data-model.md) | **select**（存在・所有確認 + プレフィル）/ **delete**（移動成功時） |
| `public.plan_packing_items` | [004-top-dive-plans/data-model.md](../004-top-dive-plans/data-model.md) | 直接操作なし。`dive_plans` 削除に伴い `on delete cascade` で連動削除（FR-011） |

## 読み書きタッチポイント

```text
[予定一覧 / 予定詳細]
   └─ (select) dive_plans … 移動可否判定 canMovePlanToLog(planned_on, todayInJst)
         │  daysUntil(planned_on, today) <= 0 のときのみ導線表示
         ▼
[/dives/new?fromPlanId=<id>]  (Server Component)
   └─ (select) dive_plans + plan_packing_items(getPlan) … prefill 用に予定を取得
         │  planToDiveDefaults(plan) → Partial<DiveFormValues>
         ▼
[DiveForm 送信]  → Server Action: createDiveFromPlan(planId, input)
   1. (select) dive_plans where id=planId … 存在・所有確認（無ければ失敗 / FR-015）
   2. (insert) dives          … createDive(input) 再利用（失敗なら予定は残す / FR-010）
   3. (delete) dive_plans where id=planId
         └─ (cascade delete) plan_packing_items  … 持ち物連動削除（FR-011）
         └─ 削除失敗時: ログは保持し planDeleteFailed を返す（FR-011a）
```

## 引き継ぎ項目マッピング（dive_plans → dives）

| dive_plans カラム | 型/上限 | dives カラム | 型/上限 | 変換 |
|---|---|---|---|---|
| `planned_on` | `date` | `dive_date` | `date`（未来日不可） | そのまま（当日以前に限定済み） |
| `location` | `text` / 120 | `location` | `text` / 120 | そのまま。`dive_site_id` は NULL（location と排他） |
| `notes` | `text` / 2000（nullable） | `notes` | `text` / 2000（nullable） | そのまま（上限一致のため切り詰め無し） |
| — | — | `dive_number` | `integer`（nullable） | 既存 new ページの自動採番（最新+1）を使用 |
| — | — | `max_depth_m` / `bottom_time_min` | 必須 | 引き継がずユーザー入力（FR-006） |

- `planned_on` は「時刻を持たない」予定（004 の Assumption）なので `entry_time` / `exit_time` は引き継がない（ユーザー任意入力）。
- `plan_packing_items`（持ち物）はログへ引き継がない。潜水前準備データであり、予定削除で消える（Edge Case / Assumption）。

## RLS（既存ポリシーで充足・新規なし）

| テーブル | 適用される既存ポリシー | 本機能での充足 |
|---|---|---|
| `dives` | 本人のみ insert（`(select auth.uid()) = user_id`） | `createDive` が `user_id = auth.uid()` で挿入 |
| `dive_plans` | 本人のみ select / delete | 存在確認 select・delete とも本人分のみ成立。他人の予定は取得も削除もできない（FR-014） |
| `plan_packing_items` | 親予定所有者のみ全操作 | cascade delete は FK 制約で実行（RLS を跨がず整合） |

新規のポリシー・トリガ・関数は不要。
