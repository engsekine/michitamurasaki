# Tasks: 忘れ物確認機能

**Input**: Design documents from `/specs/037-forgotten-item-check/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/server-actions.md, quickstart.md

**Tests**: Constitution III（Test-First）に従い、テストタスクを実装タスクの前に置く。

**Organization**: ユーザーストーリー単位でフェーズを分け、各ストーリーが独立して実装・検証できるようにする。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能（別ファイル・未完了タスクへの依存なし）
- **[Story]**: 対応するユーザーストーリー（US1 / US2 / US3）
- パスはリポジトリルートからの相対パス

## Phase 1: Setup

**Purpose**: 作業ブランチの準備（既存プロジェクトのためプロジェクト初期化は不要）

- [X] T001 develop から作業ブランチ `037-forgotten-item-check` を作成する

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 全ストーリーが依存するスキーマ・型・クエリの土台。この Phase 完了までストーリー実装に着手しない

- [X] T002 マイグレーション `supabase/migrations/<timestamp>_add_packing_completion.sql` を作成する（`dive_plans.packing_completed_at timestamptz` / `plan_packing_items.is_confirmed boolean not null default false` + `comment on column`。data-model.md 参照）。`supabase migration up` でローカル適用し `supabase db lint` を通す
- [X] T003 Supabase 型定義 `packages/supabase/src/types.ts` を再生成し、新カラムが型に反映されていることを確認する
- [X] T004 [P] `service-front/src/features/plans/types.ts` に `PackingItem.isConfirmed: boolean` と `NextPlanSummary.packingCompletedAt: string | null` / `PlanWithPacking.packingCompletedAt: string | null` を追加する
- [X] T005 `service-front/src/features/plans/server/queries.ts` の `listNextPlansWithProgress` / `getPlan` の select に `packing_completed_at` / `is_confirmed` を追加してマッピングする。既存のクエリ系テスト（`service-front/src/features/plans/lib/mappers.test.ts` 等、モックしている箇所）を新フィールドに同期する

**Checkpoint**: `npm run type-check --workspace service-front` が通り、既存テストが green のままであること

---

## Phase 3: User Story 1 - 持ち物準備を「完了」して忘れ物確認リストを受け取る (P1) 🎯 MVP

**Goal**: 完了ボタンで完了状態になり、持ち物リストが忘れ物確認リスト（全項目未確認の 2 周目チェック表示）に置き換わる

**Independent Test**: 持ち物ありの予定で完了操作 → 忘れ物確認リストが表示され、再読み込み後も保持される（quickstart シナリオ 1）

- [X] T006 [US1] `service-front/src/features/plans/server/actions.test.ts`（既存になければ新規）に `completePacking` のテストを先に書く: 正常系（packing_completed_at 設定）/ 終了済み予定は拒否（FR-009）/ 持ち物 0 件は拒否（FR-007）/ 他人の予定は拒否 / 完了済みへの再実行は状態を変えない（contracts/server-actions.md 参照）
- [X] T007 [US1] `service-front/src/features/plans/server/actions.ts` に `completePacking(planId)` を実装し T006 を green にする
- [X] T008 [US1] 忘れ物確認リストコンポーネントを新規作成する: `service-front/src/features/plans/components/client/ForgottenItemChecklist/ForgottenItemChecklist.tsx`（+ `index.ts`）。全項目を未確認から表示し、確認数（N / M）と進捗を出す（この時点では表示のみ。確認トグルは US2、解除ボタンは US3 で追加）。作成直後に `/generate-with-tests <絶対パス>` でテスト・story を生成する
- [X] T009 [US1] `service-front/src/features/plans/components/client/PackingList/PackingList.tsx`（予定詳細の持ち物リスト）に「準備完了」ボタンを追加する。持ち物 0 件・終了済み予定では表示しない。`PackingList.test.tsx` にテストを先に追加してから実装する
- [X] T010 [US1] 予定詳細ページ `service-front/src/app/(authenticated)/plans/[id]/page.tsx` で `packingCompletedAt` により `PackingList` ↔ `ForgottenItemChecklist` を出し分ける（置き換え表示 / Clarifications Q2）
- [X] T011 [US1] TOP の予定カード `service-front/src/features/plans/components/server/NextPlanCard/NextPlanCardView.tsx` で同様に出し分け、`PackingChecklist` 側にも完了ボタンを追加する。`NextPlanCardView.test.tsx` / `PackingChecklist.test.tsx` / 各 stories を同期する

**Checkpoint**: quickstart シナリオ 1 が手動で再現できる（完了 → 置き換え表示 → 再読み込みで保持 → TOP カードにも反映）

---

## Phase 4: User Story 2 - 忘れ物確認リストで出発前の最終チェックをする (P2)

**Goal**: 確認リストの項目をその場でチェックでき、状態が保存され、全確認で「忘れ物なし」表示になる

**Independent Test**: 完了済みの予定で項目を確認 → 再読み込みで保持・全確認で「忘れ物なし」（quickstart シナリオ 2）

- [X] T012 [US2] `service-front/src/features/plans/server/actions.test.ts` に `toggleConfirmItem` のテストを先に書く: 正常系 / 未完了の予定では拒否 / 終了済み予定では拒否 / 他人の項目は拒否
- [X] T013 [US2] `service-front/src/features/plans/server/actions.ts` に `toggleConfirmItem(itemId, isConfirmed)` を実装し T012 を green にする
- [X] T014 [US2] `ForgottenItemChecklist.tsx` に確認トグル（checkbox + label 関連付け・`togglePackingItem` と同じ Server Action → `router.refresh()` パターン）と「忘れ物なし」完了表示（`role="status"`）を追加する。`ForgottenItemChecklist.test.tsx` / `.stories.tsx` を同期する（テスト先行）

**Checkpoint**: quickstart シナリオ 2 が手動で再現できる

---

## Phase 5: User Story 3 - 完了を解除して準備をやり直す (P3)

**Goal**: 完了解除で通常の持ち物リストへ戻り、確認状態は破棄・準備チェックは保持される

**Independent Test**: 完了済み予定で解除 → 準備チェック保持のままリスト復帰 → 再完了で全項目未確認（quickstart シナリオ 3）

- [X] T015 [US3] `service-front/src/features/plans/server/actions.test.ts` に `uncompletePacking` のテストを先に書く: 正常系（packing_completed_at = null + 全 is_confirmed = false / is_checked は不変）/ 他人の予定は拒否 / 未完了への解除は冪等
- [X] T016 [US3] `service-front/src/features/plans/server/actions.ts` に `uncompletePacking(planId)` を実装し T015 を green にする
- [X] T017 [US3] `ForgottenItemChecklist.tsx` に「完了を解除」ボタンを追加する（終了済み予定では非表示 / FR-009）。テスト・story を同期する（テスト先行）

**Checkpoint**: quickstart シナリオ 3・4 が手動で再現できる

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T018 [P] E2E テストを追加する: `service-front/e2e/`（既存の Playwright 構成に従う）に quickstart シナリオ 1〜3 の回帰テスト（完了 → 確認 → 解除の一連フロー）
- [X] T019 [P] 関連仕様書を同期する: `specs/004-top-dive-plans/spec.md`（持ち物リストの拡張として 037 への参照を追記）・`specs/003-dashboard/screens/top.md`（TOP カードの完了時表示）
- [X] T020 総仕上げ: `npx biome check --write .`（service-front）→ `npm run type-check --workspace service-front` → `npm run test:coverage --workspace service-front`（閾値 70% 維持）→ `supabase db lint` をすべて green にし、quickstart の 4 シナリオを通しで確認する

---

## Dependencies

```text
Phase 1 (T001)
  └─> Phase 2 (T002 → T003 → T004/T005)   ※T004 と T005 は T003 完了後に並列可
        └─> Phase 3: US1 (T006 → T007、T008 は T004 完了後に並列可、T009〜T011 は T007/T008 後)
              └─> Phase 4: US2 (T012 → T013 → T014)   ※US1 の ForgottenItemChecklist に依存
              └─> Phase 5: US3 (T015 → T016 → T017)   ※US2 と並列可（同一ファイル T014/T017 のみ順次）
                    └─> Phase 6 (T018〜T020)
```

- US2 と US3 は Server Action レベルでは独立（並列可）。UI は同じ `ForgottenItemChecklist.tsx` を触るため T014 → T017 の順にする

## Parallel Execution Examples

- **Phase 2**: T004（types.ts）と T005（queries.ts）は T003 完了後に並列実行可能
- **Phase 3**: T006/T007（actions）と T008（ForgottenItemChecklist の骨組み）は別ファイルのため並列実行可能
- **Phase 4 と Phase 5**: T012/T013 と T015/T016（actions のテスト・実装）は並列実行可能
- **Phase 6**: T018（E2E）と T019（仕様書同期）は並列実行可能

## Implementation Strategy

1. **MVP = Phase 1〜3（US1）**: 完了ボタンと置き換え表示だけで「完了したら忘れ物確認リストが出る」という中核価値が成立する。ここで一度動作確認・デプロイ可能
2. **インクリメント 2 = Phase 4（US2）**: 確認トグルと「忘れ物なし」表示で忘れ物防止の目的を完成させる
3. **インクリメント 3 = Phase 5（US3）**: 解除フローで運用上の救済を追加
4. **Phase 6**: E2E・仕様書同期・品質ゲートで締める

各 Phase の終わりに Checkpoint（quickstart のシナリオ）で独立検証してから次へ進む。
