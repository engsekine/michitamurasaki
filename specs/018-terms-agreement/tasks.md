---
description: "Task list for 018-terms-agreement implementation"
---

# Tasks: 新規登録時の利用規約同意

**Input**: Design documents from `/specs/018-terms-agreement/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: 含める。Constitution III（Test-First / テスト同梱）に従い、`shared/components` / `features/*/components` は Vitest 単体テスト・Storybook story・Playwright a11y テストを必須同梱とする。スキーマ・Server Actions・mapper は Vitest、受け入れシナリオは Playwright E2E で検証する。

**Organization**: spec.md のユーザーストーリー（US1: メール登録 / US2: Google 初回ログイン）ごとにフェーズを分割。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能（別ファイル・未完了タスクへの依存なし）
- **[Story]**: US1: メール登録での同意必須＋記録 / US2: Google 初回ログインでの同意必須＋記録

## Path Conventions

- フロントエンド: `service-front/src/`（Feature-based）
- DB マイグレーション: `supabase/migrations/`

## 前提

- 既存: `001-auth`（`SignupForm` / `signup.schema.ts` / `signUp` / `handle_new_user` トリガー）、`016-google-login`（`ProfileCompletionForm` / `profile-completion.schema.ts` / `completeProfile` / `toUserDetailsInsert`）
- `handle_new_user` は 016 で `? 'nickname'` 分岐済み（メール経路のみ user_details を作成）
- `/terms` ページは既存。form コンポーネントに checkbox は無い（新設）

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 現状確認と組み込み箇所の洗い出し

- [X] T001 既存 `features/auth` の `SignupForm` / `ProfileCompletionForm` / `signup.schema` / `profile-completion.schema` / `actions.ts`（`signUp` / `completeProfile`）/ `mappers/profile-completion.ts` と、016 のトリガー `supabase/migrations/20260623100000_alter_handle_new_user_for_oauth.sql` を確認し、同意チェック・記録の組み込み箇所を洗い出す

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 両ユーザーストーリーが依存する DB 列・規約バージョン定数・共通チェックボックス

**⚠️ CRITICAL**: このフェーズ完了まで各ストーリーの実装には着手できない（記録先の列・共通 UI が無いと成立しない）

- [X] T002 [P] DB マイグレーション作成 in `supabase/migrations/<ts>_add_terms_agreement.sql`: `public.user_details` に `terms_version text`（null可）/ `terms_agreed_at timestamptz`（null可）を追加、CHECK `(terms_version is null) = (terms_agreed_at is null)` を付与、`handle_new_user()` を `create or replace`（016 の `? 'nickname'` 分岐を維持しつつメール経路 INSERT に `terms_version = raw_user_meta_data->>'terms_version'` を追記、`security definer set search_path = ''` 維持）。**`terms_agreed_at` は条件付きにする**（`case when new.raw_user_meta_data ? 'terms_version' then now() else null end`）— 無条件 `now()` だと `terms_version` 欠落時に CHECK 違反でサインアップが失敗するため（F1 対応）。data-model.md 準拠
- [X] T003 [P] `CURRENT_TERMS_VERSION` 定数を新設 in `service-front/src/shared/constants/terms.ts`（既定 `'2026-06-26'`）
- [X] T004 [P] `FormCheckbox` の Vitest 作成 in `service-front/src/shared/components/form/FormCheckbox/FormCheckbox.test.tsx`（label 関連付け・チェック切替・エラー `role="alert"` / `aria-invalid`）。contracts/forms.md 準拠
- [X] T005 [P] `FormCheckbox` の Storybook story 作成
- [ ] T006 [P] `FormCheckbox` の Playwright a11y テスト
- [X] T007 `FormCheckbox` 実装 in `service-front/src/shared/components/form/FormCheckbox/FormCheckbox.tsx` + `index.ts`、および `service-front/src/shared/components/form/index.ts` に再エクスポート追記（`input[type=checkbox]` + `<label htmlFor>`、`label: ReactNode`、`aria-invalid` / `aria-required`、RHF `register` 対応）
- [ ] T008 ローカル Supabase に T002 を適用（`supabase migration up`）し、既存メール／Google サインアップが回帰しない・既存 user_details 行が両列 NULL のままであることを確認

**Checkpoint**: 記録先の列・規約バージョン・共通チェックボックスが揃い、各ストーリーを開始できる

---

## Phase 3: User Story 1 - メール登録での同意必須＋記録 (Priority: P1) 🎯 MVP

**Goal**: `/signup` に利用規約同意チェックを追加し、未チェックでは登録できず、同意して登録すると `user_details` に同意日時・規約バージョンが記録される

**Independent Test**: `/signup` で未チェック送信→登録不可（エラー）、チェック→登録、登録後に `terms_version`/`terms_agreed_at` が記録（quickstart シナリオ A / B）

### Tests for User Story 1 ⚠️（実装前に書き、FAIL を確認）

- [X] T009 [P] [US1] `signup.schema` の `agreedToTerms` Vitest（false/未指定で reject・true で pass）in `service-front/src/features/auth/schemas/signup.schema.test.ts`（無ければ新規）
- [X] T010 [P] [US1] `signUp` の Vitest（`agreedToTerms !== true` で `actionFailure`・Supabase 未呼び出し / true で `options.data.terms_version` を含む）in `service-front/src/features/auth/server/actions.test.ts`
- [X] T011 [P] [US1] `SignupForm` の Vitest（同意チェック表示・未チェック送信で `signUp` 未呼び出し＋エラー・`/terms` リンクの href/target）
- [ ] T012 [P] [US1] Playwright E2E: 未チェックで登録不可・チェックで登録（quickstart シナリオ A）
- [ ] T013 [P] [US1] Playwright E2E（要ローカル Supabase）: メール登録後に `user_details.terms_version` / `terms_agreed_at` が記録されることを確認（quickstart シナリオ B / SC-005）

### Implementation for User Story 1

- [X] T014 [US1] `signup.schema.ts` に `agreedToTerms: yup.boolean().oneOf([true]).required()` を追加（contracts/forms.md）
- [X] T015 [US1] `signUp` を変更 in `service-front/src/features/auth/server/actions.ts`（`SignUpInput` に `agreedToTerms` 追加、先頭で未同意ガード、`options.data` に `terms_version: CURRENT_TERMS_VERSION` を追加）。contracts/server-actions.md
- [X] T016 [US1] `SignupForm` に **`TermsAgreementField`**（規約をモーダル表示し末尾スクロールで同意可。`TermsContent` を `/terms` と共有、`isScrolledToBottom` で末尾判定）を追加 in `SignupForm.tsx`。`register('agreedToTerms')` で接続し、**onSubmit の `signUp` 呼び出しに `agreedToTerms: values.agreedToTerms` を含める**（U1 対応 / FR-005・FR-005b）

**Checkpoint**: メール登録で同意必須＋記録が成立（MVP）

---

## Phase 4: User Story 2 - Google 初回ログインでの同意必須＋記録 (Priority: P2)

**Goal**: `/profile-completion` に利用規約同意チェックを追加し、未チェックでは利用開始できず、同意して補完すると同意情報が記録される

**Independent Test**: 未登録 Google で初回ログイン → 補完画面で未チェック送信→進めない、チェック→ TOP（`/`）到達＋記録（quickstart シナリオ C）

### Tests for User Story 2 ⚠️（実装前に書き、FAIL を確認）

- [X] T017 [P] [US2] `profile-completion.schema` の `agreedToTerms` Vitest（false で reject・true で pass）in `service-front/src/features/auth/schemas/profile-completion.schema.test.ts`
- [X] T018 [P] [US2] `completeProfile` の Vitest（未同意ガード / 同意で INSERT に terms 列を含む）in `service-front/src/features/auth/server/actions.test.ts`
- [X] T019 [P] [US2] `toUserDetailsInsert` の Vitest（`terms_version` / `terms_agreed_at` が INSERT ペイロードにマップされる）in `service-front/src/features/auth/server/mappers/profile-completion.test.ts`
- [X] T020 [P] [US2] `ProfileCompletionForm` の Vitest（同意チェック表示・未チェックで `completeProfile` 未呼び出し＋エラー）
- [ ] T021 [P] [US2] Playwright E2E（要ローカル Supabase + Google 設定）: Google 初回で未チェック不可・チェックで TOP（`/`）到達＋記録（quickstart シナリオ C）

### Implementation for User Story 2

- [X] T022 [US2] `profile-completion.schema.ts` に `agreedToTerms` を追加
- [X] T023 [US2] `completeProfile` を変更 in `service-front/src/features/auth/server/actions.ts`（`CompleteProfileInput` に `agreedToTerms` 追加、未同意ガード）
- [X] T024 [US2] `toUserDetailsInsert` に `terms_version = CURRENT_TERMS_VERSION` / `terms_agreed_at = new Date().toISOString()`（登録時刻、ISO 8601）を追加 in `service-front/src/features/auth/server/mappers/profile-completion.ts`。両方を必ずセットし CHECK（両方 NOT NULL）を満たす（A1 対応。メール経路はトリガーの `now()`、Google 経路はこの値）
- [X] T025 [US2] `ProfileCompletionForm` に **`TermsAgreementField`**（規約モーダル＋末尾スクロールで同意可）を追加 in `ProfileCompletionForm.tsx`

**Checkpoint**: Google 初回ログインでも同意必須＋記録が成立

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: 仕上げと回帰確認

- [ ] T026 [P] Playwright E2E: チェックボックス内「利用規約」リンクが別タブで開き、フォーム入力が保持される（quickstart シナリオ D / FR-005）
- [ ] T027 [P] Playwright E2E: 既存ユーザーの `/login` では利用規約同意を要求されない（quickstart シナリオ E / FR-007）
- [ ] T028 [P] Playwright a11y: `/signup`（および補完画面）の同意チェック表示状態で WCAG 2.1 AA 違反ゼロ（既存 a11y スイープ更新含む）
- [ ] T029 既存 `001-auth` / `016-google-login` のサインアップ回帰確認、および既存 user_details 行が両 terms 列 NULL（grandfather）で CHECK 違反しないことを確認
- [X] T030 `/review` と仕様同期（`sync-spec`）を実行し、実装と spec / plan / data-model / contracts のずれを解消（sync-spec で data-model/plan/contracts を実装に追従、review は LGTM・Error 0）

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: 依存なし
- **Foundational (Phase 2)**: Setup 後。両ストーリーをブロック（DB 列・定数・FormCheckbox）
- **User Stories (Phase 3〜4)**: Foundational 後に開始。US1 と US2 は相互に独立
- **Polish (Phase 5)**: 対象ストーリー完了後

### User Story Dependencies
- **US1 (P1)**: Foundational（T002 列＋トリガー、T003 定数、T007 FormCheckbox）後に開始可。メール経路の主動線（MVP）
- **US2 (P2)**: Foundational 後に開始可。US1 とは別ファイル中心で並列可能

### Within Each User Story
- テストを先に書き FAIL を確認 → スキーマ → Server Action / mapper → フォーム

### Parallel Opportunities
- Foundational: T002（migration）/ T003（定数）/ T004-T006（FormCheckbox テスト）は別ファイルで並列可（T007 実装は T004-T006 の後）
- 各ストーリーのテストタスク（[P]）はまとめて並列起動可
- Foundational 完了後、US1 と US2 を別担当で並列着手可

---

## Parallel Example: User Story 1

```bash
# US1 のテストを一括起動（実装前・FAIL 確認）:
Task: "signup.schema の agreedToTerms Vitest (T009)"
Task: "signUp の Vitest (T010)"
Task: "SignupForm の Vitest (T011)"
Task: "未チェック登録不可の E2E (T012)"
```

---

## Implementation Strategy

### MVP First（US1）
1. Phase 1: Setup
2. Phase 2: Foundational（DB 列＋トリガー / 定数 / FormCheckbox）
3. Phase 3: US1（メール登録の同意必須＋記録）
4. **STOP and VALIDATE**: quickstart シナリオ A/B → メール登録の同意取得が完成（MVP）

### Incremental Delivery
1. Setup + Foundational → 基盤完成
2. US1 → 検証 → MVP
3. US2（Google 経路）を追加 → 検証
4. Polish（リンク/入力保持・ログイン非適用・a11y・回帰・仕様同期）

---

## Notes
- [P] = 別ファイル・依存なし
- Constitution III に従い、`FormCheckbox` は Vitest + Storybook + Playwright a11y を同梱（`/generate-with-tests` 活用可）
- `handle_new_user` 再定義は 016 の `? 'nickname'` 分岐を必ず維持する（壊すと Google サインアップが失敗）
- 既存ユーザーは terms 両列 NULL で grandfather。未同意登録の防止はアプリ層ガード（FR-008）が担保
- サーバー側ガードはクライアント無効化に依存しない（`signUp` / `completeProfile` の双方）
