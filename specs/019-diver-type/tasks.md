---
description: "Task list for 019-diver-type implementation"
---

# Tasks: ダイバー種別・ダイバー番号の登録

**Input**: Design documents from `/specs/019-diver-type/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: 含める。Constitution III に従い、コンポーネントは Vitest + Storybook + Playwright a11y、スキーマ・Server Actions・mapper は Vitest、受け入れシナリオは Playwright E2E で検証する。

**Organization**: spec.md のユーザーストーリー（US1: ダイバー種別 / US2: ダイバー番号）ごとにフェーズを分割。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能（別ファイル・未完了タスクへの依存なし）
- **[Story]**: US1: 登録時のダイバー種別選択 / US2: インストラクターのダイバー番号

## Path Conventions
- フロントエンド: `service-front/src/`（Feature-based）
- DB マイグレーション: `supabase/migrations/`

## 前提
- 共有プロフィール: `shared/schemas/user-profile.ts`（`userProfileFields`）が signup / profile-completion / account の 3 スキーマで使われる
- 既存: `auth`（`SignupForm`/`signup.schema`/`signUp`/`ProfileCompletionForm`/`profile-completion.schema`/`completeProfile`/`toUserDetailsInsert`）、`account`（`ProfileEditForm`/`profile.schema`/`updateProfile`/`getProfile`/`toUserDetailsUpdate`）
- `handle_new_user` は 016/018 で再定義済み（メール経路のみ user_details を作成）

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 現状確認と組み込み箇所の洗い出し

- [X] T001 `auth`/`account` の 3 スキーマ・3 フォーム・Server Actions（`signUp`/`completeProfile`/`updateProfile`/`getProfile`）・mapper（`toUserDetailsInsert`/`toUserDetailsUpdate`）と、直近の `handle_new_user` マイグレーション（`supabase/migrations/20260626100000_add_terms_agreement.sql`）を確認し、ダイバー種別/番号の組み込み箇所を洗い出す

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 両ストーリーが依存する DB 列・定数・スキーマファクトリ

**⚠️ CRITICAL**: このフェーズ完了まで各ストーリーの実装には着手できない

- [X] T002 [P] DB マイグレーション作成 in `supabase/migrations/20260629100000_add_diver_type.sql`: `user_details` に `diver_type text`（null可）/ `diver_number text`（null可）を追加。CHECK ①`diver_type in ('instructor','general')` ②`diver_number` 長さ 1..50 ③ **`diver_number is null or diver_type='instructor'`**。`handle_new_user()` を `create or replace`（016/018 の `? 'nickname'` 分岐を維持しつつメール経路 INSERT に `diver_type` と「instructor のときのみ」`diver_number` を追記、`security definer set search_path=''` 維持）。data-model.md 準拠
- [X] T003 [P] `packages/supabase/src/types.ts` の `user_details`（Row/Insert/Update）に `diver_type` / `diver_number` を反映
- [X] T004 [P] `service-front/src/shared/constants/diver-type.ts` 新設（`DIVER_TYPE_VALUES` / `DIVER_TYPE_OPTIONS` / `type DiverType`）。contracts/forms.md
- [X] T005 [P] `requiredDiverFields` / `optionalDiverFields` の Vitest 作成 in `service-front/src/shared/schemas/diver.test.ts`（required で種別必須・optional で任意、`instructor` 時のみ番号許可・`general` で番号破棄、番号 51 文字で reject）
- [X] T006 `service-front/src/shared/schemas/diver.ts` 実装（`requiredDiverFields` / `optionalDiverFields` ＋共通 `diverNumberField`。番号は `.when('diverType', instructor?維持:strip)`）。contracts/forms.md
- [ ] T007 ローカル Supabase に T002 を適用（`supabase migration up`）し、既存サインアップ／プロフィール編集が回帰しない・既存行が両列 NULL のままであることを確認

**Checkpoint**: 列・定数・スキーマファクトリが揃い、各ストーリーを開始できる

---

## Phase 3: User Story 1 - 登録時のダイバー種別選択 (Priority: P1) 🎯 MVP

**Goal**: `/signup`・`/profile-completion` で種別（インストラクター/一般ダイバー）を必須選択でき、`/settings/profile` では任意で変更できる。種別がプロフィールに保存・取得される

**Independent Test**: 登録フォームで種別未選択→エラー、選択→保存。編集では未選択のまま保存可（quickstart シナリオ A 前半 / C-1）

### Tests for User Story 1 ⚠️（実装前に書き、FAIL を確認）
- [X] T008 [P] [US1] 3 スキーマへの diver フィールド組み込み Vitest（signup/profile-completion=種別必須、account=任意）in 各 `*.schema.test.ts`
- [X] T009 [P] [US1] `signUp`/`completeProfile` の Vitest（`options.data`/INSERT に `diver_type`）in `features/auth/server/actions.test.ts`
- [X] T010 [P] [US1] `updateProfile`/`getProfile` の Vitest（`diver_type` の更新・取得）in `features/account/server/actions.test.ts`
- [X] T011 [P] [US1] 3 フォームの Vitest（種別ラジオ表示・登録フォームは未選択でエラー＆Action 未呼び出し・編集は未選択でも送信可）
- [ ] T012 [P] [US1] Playwright a11y: 種別ラジオを含むフォーム表示状態の WCAG 2.1 AA

### Implementation for User Story 1
- [X] T013 [US1] `auth/schemas/signup.schema.ts` と `auth/schemas/profile-completion.schema.ts` に `...requiredDiverFields` を追加
- [X] T014 [US1] `account/schemas/profile.schema.ts` に `...optionalDiverFields` を追加
- [X] T015 [US1] `SignupForm` / `ProfileCompletionForm` / `account/ProfileEditForm` に `FormRadioGroup`（legend「ダイバー種別」・`DIVER_TYPE_OPTIONS`・`{...register('diverType')}`・`errors.diverType`）を追加し、各 onSubmit の Action 呼び出しに `diverType` を渡す
- [X] T016 [US1] `signUp`（`SignUpInput` + `options.data` に `diver_type`）/ `completeProfile`（`CompleteProfileInput`）/ `updateProfile`（`UpdateProfileInput`）/ `getProfile`（SELECT 列）を変更。contracts/server-actions.md
- [X] T017 [US1] `toUserDetailsInsert`（auth）/ `toUserDetailsUpdate`（account）に `diver_type` を追加
- [X] T017a [US1] 既存フォームテストの更新（C1 対応）: `SignupForm.test` / `ProfileCompletionForm.test` の成功送信ケースに「ダイバー種別を選択」ステップを追加（必須項目化による回帰防止）。`account/ProfileEditForm.test` は編集が任意のため種別なし保存が通ることを確認

**Checkpoint**: 3 画面で種別の選択・保存・取得が成立（MVP）

---

## Phase 4: User Story 2 - インストラクターのダイバー番号 (Priority: P2)

**Goal**: 種別がインストラクターのときだけダイバー番号欄が現れ、任意入力した番号が保存される。一般ダイバー/未設定では番号を持たない

**Independent Test**: instructor 選択→番号欄出現→入力で保存／空でも可、general 選択→番号欄なし、種別を general に変更→番号破棄（quickstart シナリオ A 後半 / C-3 / D）

### Tests for User Story 2 ⚠️
- [X] T018 [P] [US2] mapper/Action の Vitest（`instructor` で番号保存、`general`/未選択で `diver_number` が null、`updateProfile` で種別を general に変更時に null 化）
- [X] T019 [P] [US2] 3 フォームの Vitest（`instructor` 選択で番号欄が出現、`general` では非表示）
- [ ] T020 [P] [US2] Playwright E2E: instructor→番号保存／general→番号なし／種別変更で破棄（quickstart シナリオ A・C-3・D）

### Implementation for User Story 2
- [X] T021 [US2] `SignupForm` / `ProfileCompletionForm` / `account/ProfileEditForm` に条件付きの `FormField`（id `diverNumber`、label「ダイバー番号」、`{...register('diverNumber')}`）を追加し、`watch('diverType') === 'instructor'` のときだけ表示
- [X] T022 [US2] `toUserDetailsInsert` / `toUserDetailsUpdate` の `diver_number` を `diverType==='instructor' ? (diverNumber ?? null) : null` に統一（UI/スキーマ漏れを mapper で最終整合・DB CHECK ③と二重化）。contracts/server-actions.md

**Checkpoint**: インストラクターのみ番号を保持し、整合が崩れない

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: 仕上げと回帰確認

- [ ] T023 [P] 既存 a11y スイープ（公開/認証ページ）が種別・番号 UI 追加後も WCAG 2.1 AA 違反ゼロのまま回帰しないことを確認
- [ ] T024 既存 `001-auth` / `016-google-login` / `018-terms-agreement` のサインアップ・編集が回帰していないこと、既存 `user_details` 行が両列 NULL（grandfather）で CHECK 違反しないことを確認
- [X] T025 [P] 公開エクスポート整合（`diver-type` 定数・`diver` スキーマの import 経路）と、`shared/schemas/diver.ts` の命名・規約（typescript/react/sql）順守を確認
- [ ] T026 `/review` と仕様同期（`sync-spec`）を実行し、実装と spec / plan / data-model / contracts のずれを解消

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: 依存なし
- **Foundational (Phase 2)**: Setup 後。両ストーリーをブロック（列・定数・ファクトリ）
- **User Stories (Phase 3〜4)**: Foundational 後。US2 は US1 の上に番号欄を足すため US1 → US2 の順
- **Polish (Phase 5)**: 対象ストーリー完了後

### User Story Dependencies
- **US1 (P1)**: Foundational 後に開始可。種別の選択・保存（MVP の中核）
- **US2 (P2)**: US1 完了後（同じフォーム/mapper に番号を追加）。種別=instructor のときの番号挙動を上乗せ

### Within Each User Story
- テストを先に書き FAIL を確認 → スキーマ → Server Action / mapper → フォーム
- mapper（`toUserDetailsInsert`/`toUserDetailsUpdate`）は T017（種別）と T022（番号）で同一ファイルを順に編集する

### Parallel Opportunities
- Foundational: T002（migration）/ T003（types）/ T004（定数）/ T005（factory test）は別ファイルで並列可（T006 実装は T005 の後）
- 各ストーリーのテストタスク（[P]）はまとめて並列起動可

---

## Parallel Example: User Story 1

```bash
# US1 のテストを一括起動（実装前・FAIL 確認）:
Task: "3 スキーマの diver フィールド組み込み Vitest (T008)"
Task: "signUp/completeProfile の Vitest (T009)"
Task: "updateProfile/getProfile の Vitest (T010)"
Task: "3 フォームの種別ラジオ Vitest (T011)"
```

---

## Implementation Strategy

### MVP First（US1）
1. Phase 1: Setup
2. Phase 2: Foundational（migration / 定数 / factory）
3. Phase 3: US1（種別の選択・保存・取得）
4. **STOP and VALIDATE**: quickstart シナリオ A 前半・C-1 → 種別の登録/編集が完成（MVP）

### Incremental Delivery
1. Setup + Foundational → 基盤完成
2. US1 → 検証 → MVP
3. US2（インストラクター番号）を追加 → 検証
4. Polish（a11y・回帰・仕様同期）

---

## Notes
- [P] = 別ファイル・依存なし
- `handle_new_user` 再定義は 016/018 の `? 'nickname'` 分岐を必ず維持する
- 既存ユーザーは両列 NULL で grandfather。編集では種別を必須にしない（FR-009）
- `diver_number` は instructor のときのみ（UI 非表示 + yup `.when` + mapper + DB CHECK の多層で担保）
- 条件付き番号欄は各フォームで `watch` してインライン描画（`react.md`: RHF オブジェクトを子に渡さない）
