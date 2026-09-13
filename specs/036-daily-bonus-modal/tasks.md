# Tasks: デイリーボーナス獲得モーダル

**Input**: Design documents from `/specs/036-daily-bonus-modal/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/daily-bonus-modal.md

**Tests**: Constitution III（Test-First）によりテストタスクを含む。DB 統合 → コンポーネント単体 → E2E の 3 層（research.md R5）。テストは実装より先に書き、失敗を確認してから実装する。

**Organization**: ユーザーストーリー単位でフェーズを分ける。US2（ログ作成導線）は US1 のモーダルコンポーネントを拡張するため US1 完了後に着手する。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能（別ファイル・未完了タスクへの依存なし）
- **[Story]**: 対応するユーザーストーリー（US1 / US2）
- パスはすべてリポジトリルートからの相対パス

## Phase 1: Setup

**Purpose**: コンポーネントフォルダの用意。新規依存パッケージなし

- [X] T001 コンポーネントフォルダ `service-front/src/features/credits/components/client/DailyBonusModal/` を作成する（folder-structure.md の「本体 + テスト + stories + index.ts」構成の置き場）

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 付与検知の基盤（RPC 返り値 boolean 化・型・シード）。US1 / US2 の両方をブロックする

**⚠️ CRITICAL**: このフェーズ完了までユーザーストーリーの実装に着手しない

- [X] T002 `service-front/src/features/credits/server/creditRules.test.ts` に DB 統合テストを**先に**追加する（当日初回の `grant_daily_bonus` 呼び出しは `data === true`、同日 2 回目は `data === false` を返す。既存の冪等性テスト（+1 のみ）は変更しない。現行は `returns void` のため実装前に失敗することを確認）
- [X] T003 マイグレーション `supabase/migrations/20260717100000_alter_grant_daily_bonus_return_granted.sql` を作成する（`drop function public.grant_daily_bonus();` → `returns boolean` で作り直し。付与成功で `return true`・`unique_violation` で `return false`。`security definer` / `set search_path = ''` / `revoke all on function ... from public` / `grant execute ... to authenticated` / `comment on function`（返り値 = 付与発生の有無）を再設定。data-model.md 参照）
- [X] T004 [P] `packages/supabase/src/types.ts` の `grant_daily_bonus` を `{ Args: never; Returns: boolean }` に更新する（T003 完了後）
- [X] T005 [P] `supabase/seed.sql.template` を更新する（① `test@` / `buddy@` / `rename@` / `admin@` の 4 ユーザーへ `select public.apply_credit_ledger_entry('<id>', 'daily_bonus', 1, (now() at time zone 'Asia/Tokyo')::date);` で当日分を事前付与（既存 E2E をモーダルから守る。理由コメント必須） ② モーダル E2E 専用ユーザー `bonus@example.com`（id 例: `000000b0-...-0005`・handle: `bonus-hanako`・password: `password123`・auth.identities 込み・**daily_bonus は付与しない**）を新設。T003 完了後）
- [X] T006 `make supabase-reset` を実行してマイグレーション + シードを適用し、T002 の DB 統合テストが green になることを確認する（`cd service-front && npx vitest run src/features/credits/server`。T003〜T005 完了後）

**Checkpoint**: RPC が付与有無を返し、シードに検証用ユーザーが揃った状態。以降 US1 に着手可能

---

## Phase 3: User Story 1 - デイリーボーナスの獲得をモーダルで知る (Priority: P1) 🎯 MVP

**Goal**: 付与が発生した訪問でのみ、獲得内容と残枠数を示すモーダルが 1 回表示され、閉じられ、同日中は再表示されない（FR-001〜003 / FR-005〜007）

**Independent Test**: `bonus@example.com` の初回ログインでモーダルが表示され、閉じられ、リロードで再表示されない。`test@example.com` では表示されない（quickstart.md 1 / 3）

- [X] T007 [US1] `service-front/src/features/credits/components/client/DailyBonusModal/DailyBonusModal.test.tsx` を**先に**作成する（① ダイアログとして表示され「デイリーボーナス獲得！」タイトルが支援技術に伝わる ② 「ログ枠が 1 つ増えました」本文 ③ `remainingCredits={5}` で「残り枠: 5」表示 ④ `remainingCredits={null}` で枠数表示を省略 ⑤ 閉じるボタンで閉じる。実装前に失敗を確認）
- [X] T008 [US1] `DailyBonusModal.tsx` を実装する（`'use client'`・Props `{ remainingCredits: number | null }`・`@/shared/components/ui/Dialog` ラッパー使用・マウント時 open・contracts/daily-bonus-modal.md の UI 契約どおり。T007 のテストを green にする）
- [X] T009 [P] [US1] `DailyBonusModal.stories.tsx` を作成する（残枠あり / 残枠 null の 2 story。T008 完了後）
- [X] T010 [P] [US1] 再 export 専用の `index.ts` を作成する（`export { DailyBonusModal } from './DailyBonusModal';`。T008 完了後）
- [X] T011 [US1] `service-front/src/app/(authenticated)/layout.tsx` を変更する（`const { data: granted, error } = await supabase.rpc('grant_daily_bonus')` に変更し、`granted === true` のときのみ `getCreditBalance().catch(() => null)` で残枠を取得して `<DailyBonusModal remainingCredits={...} />` を children と並べて描画。エラー時は従来どおり console.error のみ。contracts の呼び出し元契約参照）
- [X] T012 [US1] E2E `service-front/tests/daily-bonus-modal.spec.ts` を新規作成する（① `bonus@example.com` 初回ログイン → モーダル表示 → axe 検証（WCAG 2.1 AA 違反 0 件）→ Esc で閉じる → ハードリロードで再表示なし ② `test@example.com` ログイン → モーダル非表示。※ db reset 直後 1 回のみ成立する旨をファイル冒頭コメントに明記。T011 完了後）
- [X] T013 [US1] 既存 E2E の回帰確認（`npx playwright test tests/social-flows.spec.ts tests/sns-share.spec.ts tests/a11y --project=chromium` が green = シード事前付与の効果でモーダルが既存テストに出ないこと。T012 完了後）

**Checkpoint**: US1 単独で quickstart.md「1 / 3」が成功 = MVP 完成

---

## Phase 4: User Story 2 - モーダルからログ作成へ進む (Priority: P2)

**Goal**: モーダルの「ログを書く」導線からログ作成ページへ遷移できる（FR-004）

**Independent Test**: モーダル表示中に「ログを書く」で `/dives/new` へ遷移。閉じるだけなら遷移しない（quickstart.md 2）

- [X] T014 [US2] `DailyBonusModal.test.tsx` に導線テストを**先に**追加する（「ログを書く」リンクが `/dives/new` を指す。実装前に失敗を確認）
- [X] T015 [US2] `DailyBonusModal.tsx` に「ログを書く」導線（`/dives/new` への Link・`buttonVariants` スタイル）を追加し、`DailyBonusModal.stories.tsx` を同期する（T014 完了後）
- [X] T016 [US2] `tests/daily-bonus-modal.spec.ts` に導線の E2E を追加する（モーダルの表示は db reset 後 1 回しか発生しないため、US1 のテストに「ログを書く」→ `/dives/new` 到達 + モーダルが閉じることを統合。この過程で「クライアント遷移ではモーダルが閉じない」実バグを検出し、リンククリック時に閉じる実装を追加した）

**Checkpoint**: US1・US2 とも quickstart.md の該当節が成功

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: 横断的な仕上げ・検証

- [X] T017 quickstart.md の検証を実施する（`bonus@example.com` の表示フロー・`test@example.com` の非表示・E2E / Vitest / axe すべて green を確認）
- [X] T018 `npx biome check .` を実行し、指摘があれば `npx biome check --write .` + 手動修正で解消する
- [X] T019 `/sync-spec` で spec.md / plan.md / data-model.md と実装のずれを確認し、ズレがあれば仕様書側を実装に合わせて更新する（026 の spec.md にも返り値変更の追記が必要か確認する）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1（Setup）**: 依存なし
- **Phase 2（Foundational）**: T002（テスト先行）→ T003（migration）→ T004 / T005（並列可）→ T006（reset + green 確認）。**US1 / US2 をブロックする**
- **Phase 3（US1）**: Phase 2 完了後。T007 → T008 → T009 / T010（並列可）→ T011 → T012 → T013
- **Phase 4（US2）**: US1 と同一コンポーネント・同一 E2E ファイルを拡張するため **Phase 3 完了後**（T014 → T015 → T016）
- **Phase 5（Polish）**: 全ストーリー完了後

### Within Each Story

- テストを先に書き、失敗を確認してから実装（T002→T003、T007→T008、T014→T015）
- DB（migration）→ 型 → シード → UI → layout 結合 → E2E の順

### Parallel Opportunities

- Phase 2: T004 / T005 が並列可（T003 完了後）
- Phase 3: T009 / T010 が並列可（T008 完了後）
- US2 は US1 のコンポーネントを拡張するため並列不可（例外的に直列）

## Parallel Example: Phase 2

```bash
# T003（migration）完了後、並列で:
Task: "packages/supabase/src/types.ts の Returns を boolean に（T004）"
Task: "supabase/seed.sql.template に事前付与 + bonus ユーザー追加（T005）"
```

## Implementation Strategy

### MVP First（US1 のみ）

1. Phase 1 → Phase 2（RPC boolean 化・シード整備）
2. Phase 3（US1: モーダル表示）
3. **STOP & VALIDATE**: quickstart.md「1 / 3」で単独検証 → MVP としてデモ可能
4. Phase 4（US2: ログ作成導線）→ Phase 5（Polish）

### Notes

- 各タスク（または論理的なまとまり）ごとにコミットする（`feat(036):` / `test(036):` プレフィックス）
- マイグレーション適用・シード反映には `make supabase-reset` が必要（T006）。E2E は reset 直後に実行する
- モーダル表示 E2E（T012）は付与の冪等性により同日中の再実行に reset が必要（data-model.md 注意点）
- 026 の付与ルール自体（1 日 1 枠・JST・冪等）には一切手を入れない（FR-007）
