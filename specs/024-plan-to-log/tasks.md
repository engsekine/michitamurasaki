---
description: "Task list for 024-plan-to-log implementation"
---

# Tasks: ダイビング予定をログへ移動

**Input**: Design documents from `/specs/024-plan-to-log/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: 含める。Constitution III（Test-First / テスト同梱）に従い、変更する `features/*/components`（`DiveForm` / `PlanList`）は Vitest 単体テスト・Storybook story を同期更新し、新規 pure helper・Server Action・hook は Vitest を同梱する。受け入れシナリオは Playwright E2E（quickstart.md S1・S2）+ axe-core で検証する。

**Organization**: spec.md のユーザーストーリーごとにフェーズを分割。US1: 予定からログを起こして記録（P1）/ US2: 未来の予定は移動できない（P2）。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能（別ファイル・未完了タスクへの依存なし）
- **[Story]**: US1: 予定→ログ移動（プレフィル + 作成 + 予定削除）/ US2: 未来日予定の移動導線ゲート

## Path Conventions

- フロントエンド: `service-front/src/`（Feature-based）
- DB マイグレーション: **なし**（本フィーチャーはスキーマ変更を伴わない / data-model.md 参照）

## 前提（既存資産・再利用）

- `002-dive-log-crud`: `DiveForm`（`components/client/DiveForm`）/ `createDive`（`server/actions.ts`）/ `useDiveFormSubmit`（`hooks/`）/ `dive.schema.ts`（`DiveFormValues`・潜水日は未来日不可）/ `getLatestDiveNumber` / `dives/[id]/page.tsx`
- `004-top-dive-plans`: `getPlan`（`plans/server/queries.ts`）/ `deletePlan`（`plans/server/actions.ts`）/ `PlanList`（`components/client/PlanList`）/ `PlanView` 型 / `plans/[id]/page.tsx`
- `shared/lib/date`: `daysUntil` / `todayInJst`
- `shared/types/action-result`: `ActionResult` / `actionSuccess` / `actionFailure`
- 新規テーブル・RLS・マイグレーションは不要（既存 `dives` insert + `dive_plans` delete + `plan_packing_items` cascade）

---

## Phase 1: Setup

**Purpose**: 現状確認と組み込み箇所の洗い出し

- [X] T001 既存資産を確認し組み込み箇所を洗い出す: `service-front/src/features/dives/server/actions.ts`（`createDive` の入出力）、`service-front/src/features/dives/hooks/useDiveFormSubmit.ts`（`serverWarning` / 新規作成分岐 / `router.push`）、`service-front/src/features/dives/components/client/DiveForm/DiveForm.tsx`（`DiveFormProps`・`defaultValues`）、`service-front/src/app/(authenticated)/dives/new/page.tsx`（`nextDiveNumber` 自動採番）、`service-front/src/app/(authenticated)/dives/[id]/page.tsx`（詳細表示・通知の差し込み位置）、`service-front/src/features/plans/server/queries.ts`（`getPlan` の戻り値 `PlanView`）、`service-front/src/features/plans/components/client/PlanList/PlanList.tsx`（`today` prop・`PlanCard`）、`service-front/src/app/(authenticated)/plans/[id]/page.tsx`（`remaining` 判定・操作行）

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 両ストーリーが依存する pure helper（移動可否判定・予定→初期値変換）

**⚠️ CRITICAL**: この 2 helper が無いと導線ゲート（US2）もプレフィル（US1）も成立しない

- [X] T002 [P] 移動可否判定 pure helper を新設 in `service-front/src/features/plans/lib/canMovePlanToLog/canMovePlanToLog.ts`（`canMovePlanToLog(plannedOn: string, today: string): boolean` = `daysUntil(plannedOn, today) <= 0`。当日=true / 過去=true / 未来=false）+ 再export `index.ts`。contracts/ui-and-forms.md §1 準拠
- [X] T003 [P] T002 の Vitest を作成 in `service-front/src/features/plans/lib/canMovePlanToLog/canMovePlanToLog.test.ts`: 過去日=true・今日=true・未来日=false・JST 境界（`today` 固定）を検証
- [X] T004 [P] `features/plans/index.ts` から `canMovePlanToLog` を再export（外部は index 経由 import）in `service-front/src/features/plans/index.ts`
- [X] T005 [P] 予定→ログ初期値の pure mapper を新設 in `service-front/src/features/dives/lib/planToDiveDefaults/planToDiveDefaults.ts`（`planToDiveDefaults(plan: PlanView): Partial<DiveFormValues>` = `{ diveDate: plan.plannedOn, location: plan.location, notes: plan.notes }`（notes は null のまま）。`diveSiteId` は設定しない）+ 再export `index.ts`。contracts/ui-and-forms.md §3 / data-model.md マッピング表準拠
- [X] T006 [P] T005 の Vitest を作成 in `service-front/src/features/dives/lib/planToDiveDefaults/planToDiveDefaults.test.ts`: plannedOn→diveDate・location→location・notes→notes（null のまま）・`diveSiteId` 未設定・`maxDepthM`/`bottomTimeMin` を含まないことを検証。**FR-008 は design-covered**（plan/dive とも location 120・notes 2000 で上限一致のため切り詰め不要）である旨をコメントで残し、上限一致を前提とした 1 ケース（上限長の notes がそのまま引き継がれる）を含める
- [X] T007 [P] `features/dives/index.ts` から `planToDiveDefaults` を再export in `service-front/src/features/dives/index.ts`

**Checkpoint**: helper が単体で green → 各ストーリーの UI / Action 実装に着手可能

---

## Phase 3: User Story 1 - 予定からログを起こして記録する (Priority: P1) 🎯 MVP

**Goal**: 当日以前の予定から「ログに記録する」→ 予定内容がプレフィルされた新規ログフォームで潜水データを補って保存 → ログ作成成功時に元の予定を削除する。

**Independent Test**: 当日/過去の予定詳細で「ログに記録する」→ 潜水日・ポイント名・メモが引き継がれたフォーム → 最大水深・潜水時間を入力して保存 → ログ詳細へ遷移し、`/plans` から元予定が消える（持ち物も連動削除）。

### 実装

- [X] T008 [US1] `createDiveFromPlan(planId, input)` Server Action を追加 in `service-front/src/features/dives/server/actions.ts`: (1) `auth.getUser()` で未認証拒否、(2) `dive_plans` を `planId` で select し無ければ `actionFailure('この予定は既に移動済みか削除されています')`（ログ作成しない / FR-015）、(3) `createDive(input)` を再利用しログ作成、失敗ならその `result` を返す（予定を残す / FR-010）、(4) `dive_plans` を delete（`plan_packing_items` は cascade / FR-011）、delete エラー時は `actionSuccess({ ...result, planDeleteFailed: true })`（ログ保持 / FR-011a）、(5) `revalidatePath('/plans')`・`revalidatePath('/')`、(6) `actionSuccess({ id, buddyWarning? })`。戻り型 `ActionResult<{ id: string; buddyWarning?: string; planDeleteFailed?: boolean }>`。contracts/server-actions.md 準拠
- [X] T009 [US1] T008 の Vitest を作成 in `service-front/src/features/dives/server/actions.createDiveFromPlan.test.ts`（既存 dives テストの配置規約に合わせる。別ファイル）: 正常移動（作成→削除順）、予定が存在しない→ログ作成せず失敗（FR-015）、`createDive` 失敗時に予定を残す（FR-010）、delete 失敗時に `planDeleteFailed: true` でログ保持（FR-011a）、未認証拒否（FR-014）。Supabase クライアントと `createDive` はモック
- [X] T010 [US1] `DiveForm` に `fromPlanId?: string` prop を追加し `useDiveFormSubmit(diveId, fromPlanId)` へ委譲 in `service-front/src/features/dives/components/client/DiveForm/DiveForm.tsx`（フォーム UI は不変。引き継ぎ値は `defaultValues` 経由）。contracts/ui-and-forms.md §4
- [X] T011 [US1] `useDiveFormSubmit` を `useDiveFormSubmit(diveId?, fromPlanId?)` に拡張 in `service-front/src/features/dives/hooks/useDiveFormSubmit.ts`: 新規作成分岐で `fromPlanId` があれば `createDiveFromPlan(fromPlanId, values)` を呼ぶ。成功時は `/dives/{id}` へ遷移するが、`result.planDeleteFailed` が true のときは **`/dives/{id}?planDeleteFailed=1` へ遷移**（通知は遷移先ページで表示 / T017・§6。`serverWarning` はアンマウントで失われるため使わない）。失敗時は `serverError` 表示で遷移しない。編集分岐・写真・buddyWarning は不変。contracts/ui-and-forms.md §5
- [X] T012 [US1] T011 の Vitest を作成/更新 in `service-front/src/features/dives/hooks/useDiveFormSubmit.test.ts`: `fromPlanId` 無→`createDive`・有→`createDiveFromPlan` の呼び分け、成功→`/dives/{id}` 遷移、`planDeleteFailed`→`/dives/{id}?planDeleteFailed=1` 遷移、`!success`→遷移しない
- [X] T013 [US1] `/dives/new` を searchParams 対応に変更 in `service-front/src/app/(authenticated)/dives/new/page.tsx`: `fromPlanId` があれば `getPlan(fromPlanId)` → 予定が存在し `canMovePlanToLog(plan.plannedOn, todayInJst())` が true のとき `planToDiveDefaults(plan)` を `{ diveNumber: nextDiveNumber }` にマージして `defaultValues` に渡し `fromPlanId` を `DiveForm` へ渡す。予定なし/未来日は `fromPlanId` を無視し通常フォーム表示（graceful）。contracts/ui-and-forms.md §2
- [X] T014 [US1] 予定詳細に「ログに記録する」導線を追加 in `service-front/src/app/(authenticated)/plans/[id]/page.tsx`: `canMovePlanToLog(plan.plannedOn, todayInJst())` が true のとき、編集/削除と同じ操作行に `Link`（`buttonVariants({ variant: 'default' })`・`href={/dives/new?fromPlanId=${plan.id}}`・`aria-label="<ポイント名>の予定をログに記録する"`）を表示。未来日は非表示。**本人限定は認証ルート + `getPlan` の RLS で担保（FR-003）**。contracts/ui-and-forms.md §1
- [X] T015 [US1] `DiveForm.stories.tsx` に「予定から引き継いだ初期値」story を追加 in `service-front/src/features/dives/components/client/DiveForm/DiveForm.stories.tsx`（`defaultValues` に diveDate/location/notes + `fromPlanId` を与えた状態）
- [X] T016 [US1] `DiveForm.test.tsx` を同期更新 in `service-front/src/features/dives/components/client/DiveForm/DiveForm.test.tsx`: `fromPlanId`/`defaultValues` を渡したとき引き継ぎ値が表示され、編集可能であること（FR-007）
- [X] T017 [US1] ログ詳細に部分失敗通知を追加 in `service-front/src/app/(authenticated)/dives/[id]/page.tsx`: `searchParams.planDeleteFailed === '1'` のとき、ログ本体上部に `role="status"` の非ブロッキング通知（「ログは作成されましたが、元の予定の削除に失敗しました。ダイビング予定一覧から手動で削除してください。」+ `/plans` への Link）を表示。クエリ無し時は不変（FR-011a）。contracts/ui-and-forms.md §6
- [X] T018 [US1] 予定→ログ移動の Playwright E2E + axe-core を作成（quickstart.md S1/S3/S4）: 当日以前の予定から移動成功でログ +1・予定 −1、必須未入力で非作成、途中離脱で非移動。テスト配置は既存 E2E ディレクトリ規約に合わせる

**Checkpoint**: US1 単独で「予定詳細 → 移動 → ログ作成 → 予定削除」が動作（MVP 完成）

---

## Phase 4: User Story 2 - まだ潜っていない未来の予定は移動できない (Priority: P2)

**Goal**: 未来日の予定には「ログに記録する」導線を出さない。予定一覧・予定詳細の両面で当日以前のみ操作可能にする。

**Independent Test**: 未来日（「あと N 日」）の予定カード・予定詳細に導線が出ず、当日/過去の予定には出る。

### 実装

- [X] T019 [US2] `PlanList` の対象カードに「ログに記録する」導線を追加 in `service-front/src/features/plans/components/client/PlanList/PlanList.tsx`: `PlanCard` に `today`（既存 prop）を渡し `canMovePlanToLog(plan.plannedOn, today)` が true のカードにのみ `Link`（`href={/dives/new?fromPlanId=${plan.id}}`・可視テキスト + `aria-label`）を表示。未来日（これから・N>0）は非表示。終了済み・今日は表示。**本人限定は認証ルート + `getPlan` の RLS で担保（FR-003）**。contracts/ui-and-forms.md §1
- [X] T020 [US2] T014 の予定詳細導線が未来日で非表示になることを確認・必要なら調整 in `service-front/src/app/(authenticated)/plans/[id]/page.tsx`（US1 で `canMovePlanToLog` ガード済み。US2 の受け入れ観点で担保）
- [X] T021 [US2] `PlanList.test.tsx` を同期更新 in `service-front/src/features/plans/components/client/PlanList/PlanList.test.tsx`: 過去/今日のカードに導線あり・未来日カードに導線なし（`today` を固定して検証）
- [X] T022 [US2] `PlanList.stories.tsx` を同期更新 in `service-front/src/features/plans/components/client/PlanList/PlanList.stories.tsx`: 未来/今日/終了済みが混在し導線の出し分けが分かる story
- [X] T023 [US2] 未来日ゲートの Playwright E2E + axe-core を作成（quickstart.md S2）: 未来日予定は一覧・詳細とも「ログに記録する」が出ないこと

**Checkpoint**: US1 + US2 で導線の出し分けが正しく、未来日予定の誤操作が起きない

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: 仕様同期・部分失敗の自動検証・規約チェック

- [X] T024 [P] 部分失敗（FR-011a）と重複防止（FR-015）が自動テストで担保されていることを確認（quickstart.md S5/S6 は T009/T012/T017 でカバー済み。不足があれば補完）
- [X] T025 [P] `/sync-spec specs/024-plan-to-log` を実行し、実装と `spec.md` / `contracts/` / `data-model.md` のズレを確認・修正（特に導線ラベル・通知文言・遷移先クエリ `planDeleteFailed`）
- [X] T026 [P] `/code-fix` 相当でコード規約（TypeScript strict・早期リターン・Tailwind・命名）と a11y（`Link` のキーボード操作・`aria-label`・通知の `role="status"`）を最終チェック in 変更ファイル一式
- [ ] T027 quickstart.md S1〜S6 を手動/自動で通し確認し、SC-001〜SC-005（再入力ゼロ・1 分以内・作成/削除 1 対 1・失敗時の非二重作成/非消失・未来日ガード）を満たすことを検証

---

## Dependencies & Execution Order

### フェーズ依存

- **Setup（T001）** → 最初
- **Foundational（T002–T007）** → Setup 後・全ストーリーの前（**ブロッキング**）
- **US1（T008–T018）** → Foundational 後。MVP
- **US2（T019–T023）** → Foundational 後。US1 の導線（T014）・page 変更（T013）に一部依存（同じ page/新導線を扱うため US1 完了後が安全）
- **Polish（T024–T027）** → US1・US2 後

### ストーリー独立性

- US1 は Foundational のみに依存し、予定詳細からの移動として単独で価値を出せる（MVP）。
- US2 は Foundational + US1 の導線基盤の上で「未来日を出さない」ゲートを一覧へ拡張・保証する増分。

### 並列実行の機会

- Foundational: **T002/T003/T004（plans 側）** と **T005/T006/T007（dives 側）** は別ファイルのため並列可（`[P]`）。
- US1 内: T009（action テスト）は T008 後。T010/T011 は T008 に依存。T012 は T011 後。T015/T016 は T010 後。T017 は独立ページ（T011 の遷移先仕様に整合）。E2E（T018）は US1 実装完了後。
- US2 内: T021/T022 は T019 後。T023 は US2 実装後。
- Polish: T024/T025/T026 は `[P]`、T027 は最後。

---

## Implementation Strategy

### MVP スコープ（最小）

**Phase 1 + Phase 2 + Phase 3（US1）** = 予定詳細から当日以前の予定を 1 本のログへ移動できる。ここで「二度書きせずログ化」というコア価値が成立する。

### 増分デリバリ

1. Setup → Foundational helper（green）
2. US1 完成 → MVP（予定詳細からの移動）をデモ/検証
3. US2 追加 → 一覧への導線拡張 + 未来日ガードを保証
4. Polish → 仕様同期・規約/a11y・受け入れ確認

### 備考

- DB マイグレーションは**なし**（data-model.md）。既存 RLS がそのまま適用される。
- 変更コンポーネント（`DiveForm` / `PlanList`）は同階層の test/story を同期更新する（Constitution III・CLAUDE.md テスト同期ルール）。大幅変更時は `/generate-with-tests <path>` の利用を検討。
- FR-011a の通知は**ログ詳細ページの `searchParams.planDeleteFailed`**（Server Component）で表示し、クライアント state に依存しない（遷移後も確実に表示）。
