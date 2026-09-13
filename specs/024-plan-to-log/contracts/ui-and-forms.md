# Contract: UI・フォーム・プレフィル

## 1. 移動導線（予定一覧 / 予定詳細）

### 可否判定 helper `canMovePlanToLog(plannedOn, today)`

**配置**: `service-front/src/features/plans/lib/canMovePlanToLog/`（pure・+ test/index）

```ts
canMovePlanToLog(plannedOn: string, today: string): boolean
// return daysUntil(plannedOn, today) <= 0   // 当日(0)・過去(<0)=true / 未来(>0)=false
```

- `today` はサーバーで `todayInJst()` を渡す（既存 `PlanList` / 詳細ページと同じ流儀）。

### 配置とラベル

| 画面 | 位置 | 表示条件 | 実体 |
|---|---|---|---|
| 予定詳細 `/plans/[id]` | 「編集 / 削除」ボタンと同じ操作行 | `canMovePlanToLog(plannedOn, todayInJst())` が true | `Link`（`buttonVariants({ variant: 'default' })`）→ `/dives/new?fromPlanId=<id>` |
| 予定一覧 `/plans`（`PlanList` 内 `PlanCard`） | 対象カードのアクション | 同上（`today` prop を利用） | `Link`（`buttonVariants({ variant: 'outline', size: 'sm' })`）→ `/dives/new?fromPlanId=<id>` |

- ラベル: 「ログに記録する」。未来日の予定には**表示しない**（非表示。FR-002）。
- アクセシビリティ: `Link` によりキーボード操作可。アイコンのみにせず可視テキストを持つ。予定日・ポイントが同カード内で読めるため、リンクには `aria-label`（例: 「<ポイント名>の予定をログに記録する」）を付与して文脈を補う。

## 2. 遷移先ページ `/dives/new`（Server Component の変更）

**対象**: `service-front/src/app/(authenticated)/dives/new/page.tsx`

- `searchParams` から `fromPlanId` を受け取る。
- `fromPlanId` あり:
  1. `getPlan(fromPlanId)` で予定を取得（本人分・RLS）。
  2. 予定が存在し `canMovePlanToLog(plan.plannedOn, todayInJst())` が true → `planToDiveDefaults(plan)` を `{ diveNumber: nextDiveNumber }` にマージして `DiveForm` の `defaultValues` に渡し、`fromPlanId` を `DiveForm` に渡す。
  3. 予定が無い / 未来日 → `fromPlanId` を無視し通常の新規作成フォームを表示（プレフィルなし・移動扱いにしない）。graceful degradation。
- `fromPlanId` なし: 現行どおり通常の新規作成。
- パンくず・metadata は現行を踏襲。

## 3. プレフィル mapper `planToDiveDefaults(plan)`

**配置**: `service-front/src/features/dives/lib/planToDiveDefaults/`（pure・+ test/index）

```ts
planToDiveDefaults(plan: PlanView): Partial<DiveFormValues>
// { diveDate: plan.plannedOn, location: plan.location, notes: plan.notes }（notes は null のまま渡す）
```

| 予定 | → DiveFormValues | 備考 |
|---|---|---|
| `plannedOn` | `diveDate` | 当日以前限定のため潜水日制約 OK |
| `location` | `location` | `diveSiteId` は設定しない（排他ルール） |
| `notes` | `notes` | 上限一致（2000）で切り詰め不要 |

- 必須の `maxDepthM` / `bottomTimeMin` は含めない（ユーザー入力 / FR-006）。
- `diveNumber` は page 側の自動採番とマージ（mapper は関与しない / FR-013）。

## 4. `DiveForm` の変更

**対象**: `service-front/src/features/dives/components/client/DiveForm/DiveForm.tsx`

- `DiveFormProps` に `fromPlanId?: string` を追加。
- `fromPlanId` を `useDiveFormSubmit(diveId, fromPlanId)` へ委譲するのみ（フォームの見た目は不変。引き継ぎ値は `defaultValues` 経由で既に反映）。
- 引き継ぎ値はユーザーが自由に編集可能（FR-007）。

## 5. `useDiveFormSubmit` の変更

**対象**: `service-front/src/features/dives/hooks/useDiveFormSubmit.ts`

- シグネチャ: `useDiveFormSubmit(diveId?: string, fromPlanId?: string)`。
- 新規作成分岐で `fromPlanId` があるとき:
  - `createDive(values)` の代わりに `createDiveFromPlan(fromPlanId, values)` を呼ぶ。
  - `result.planDeleteFailed` が true のとき（ログは作成済み・成功扱い / FR-012 に従い遷移する）: **`/dives/{id}?planDeleteFailed=1` へ遷移する**。`serverWarning` state はフォームのアンマウントで失われるため通知媒体には使わない。通知は遷移先の**ログ詳細ページ側**で行う（下記 §6）。
  - 失敗（`!success`）時は現行どおり `serverError` を表示し、遷移しない（予定も残る / FR-010）。
- 編集分岐・写真アップロード・buddyWarning の既存挙動は不変。

## 6. 部分失敗通知（ログ詳細ページ）

**対象**: `service-front/src/app/(authenticated)/dives/[id]/page.tsx`

- `searchParams.planDeleteFailed === '1'` のとき、ログ本体の上部に `role="status"` の非ブロッキング通知を表示する（FR-011a）:
  「ログは作成されましたが、元の予定の削除に失敗しました。ダイビング予定一覧から手動で削除してください。」
- 予定一覧 `/plans` への導線リンクを通知内に含める。
- クエリが無い通常閲覧時は何も表示しない（既存表示は不変）。
- Server Component 内で `searchParams` を読むだけで、クライアント state に依存しないため遷移後も確実に表示される。

### 警告/エラー表示の a11y

- `serverError` は `role="alert"`、`serverWarning` は `role="status"` 相当で通知（既存パターン踏襲）。色のみに依存しない。
