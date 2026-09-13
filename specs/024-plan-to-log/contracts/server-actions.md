# Contract: Server Actions

## `createDiveFromPlan(planId, input)`

**配置**: `service-front/src/features/dives/server/actions.ts`（`createDive` と同一モジュール・`'use server'`）

**目的**: 予定を 1 本のログへ「移動」する。ログを作成し、成功時に元の予定を削除する（FR-004〜FR-012）。

### シグネチャ

```ts
createDiveFromPlan(
  planId: string,
  input: DiveFormValues,
): Promise<ActionResult<{ id: string; buddyWarning?: string; planDeleteFailed?: boolean }>>
```

- `input` は `DiveForm` が送出する `DiveFormValues`（既存 `createDive` と同型）。ユーザーがフォーム上で編集した最終値（引き継ぎ値は初期値に過ぎない / FR-007）。
- 戻り値は `createDive` の戻り値（`id` / `buddyWarning`）に `planDeleteFailed` を加えたもの。

### 処理順序（必須）

| # | 処理 | 失敗時の挙動 | 根拠 |
|---|---|---|---|
| 1 | `auth.getUser()` で認証確認 | 未認証 → `actionFailure('ログインが必要です')` | FR-014 |
| 2 | `dive_plans` から `planId` を select（本人分・RLS） | 見つからない → `actionFailure('この予定は既に移動済みか削除されています')`（**ログを作成しない**） | FR-015（重複作成防止） |
| 3 | `planned_on` の未来日検証（JST の今日を基準） | 未来日 → `actionFailure('未来の予定はログに移動できません。予定日を過ぎてから移動してください')`（**ログを作成しない**） | FR-002 |
| 4 | `createDive(input)` を呼びログ作成 | `!result.success` → その `result` をそのまま返す（**予定は削除しない**） | FR-006 / FR-010 |
| 5 | `dive_plans` を `planId` で delete（`plan_packing_items` は cascade） | delete エラーまたは削除行数 0 → `actionSuccess({ ...result, planDeleteFailed: true })`（**ログは保持**） | FR-011 / FR-011a / FR-015 |
| 6 | `revalidatePath('/plans')` / `revalidatePath('/')`（次の予定カード） | — | 一覧・TOP の再検証 |
| 7 | `actionSuccess({ id: result.id, buddyWarning?: result.buddyWarning })` を返す | — | FR-012 / FR-013 |

- ステップ 2 の存在確認はログ作成の**前**に行う（作成後に確認しても重複ログは防げない）。
- ステップ 3 で `createDiveFromPlan` がサーバー側で `planned_on` を検証し、未来日は「未来の予定はログに移動できません。予定日を過ぎてから移動してください」で拒否する（FR-002）。UI の導線出し分けには依存しない。
- ステップ 4 は既存 `createDive` を再利用し、写真・バディ同期を含む挙動を重複実装しない。

### 成功/失敗レスポンス例

| ケース | 戻り値 |
|---|---|
| 正常移動 | `{ success: true, id: '<diveId>' }` |
| バディ同期のみ一部失敗 | `{ success: true, id: '<diveId>', buddyWarning: '...' }` |
| ログ作成成功・予定削除失敗 | `{ success: true, id: '<diveId>', planDeleteFailed: true }` |
| 予定が既に存在しない | `{ success: false, error: 'この予定は既に移動済みか削除されています' }` |
| ログ作成失敗（必須未入力等） | `{ success: false, error: '<createDive のエラー>' }` |
| ログ枠不足（026 / FR-012。予定は削除されない） | `{ success: false, error: 'ログ枠がないため作成できません', code: 'no_credit' }` |
| 未認証 | `{ success: false, error: 'ログインが必要です' }` |

## 既存 Action の再利用（変更なし）

- `createDive`（`features/dives/server/actions.ts`）: そのまま呼び出す。シグネチャ変更なし。
- `getPlan`（`features/plans/server/queries.ts`）: `/dives/new` の Server Component が prefill 用に使用（既存）。
- `deletePlan`（`features/plans/server/actions.ts`）: 本 Action では使用しない（`createDiveFromPlan` 内で `dive_plans` を直接 delete）。予定一覧からの手動削除導線としては引き続き利用。
