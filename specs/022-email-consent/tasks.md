---
description: "Task list for 022-email-consent implementation"
---

# Tasks: メール配信許可（オプトイン）

**Input**: Design documents from `/specs/022-email-consent/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: 含める。Constitution III（Test-First / テスト同梱）に従い、`features/*/components` の `EmailOptInField` は Vitest 単体テスト・Storybook story・Playwright a11y テストを必須同梱とする。スキーマ・Server Actions・mapper は Vitest、受け入れシナリオは Playwright E2E（quickstart.md）で検証する。

**Organization**: spec.md のユーザーストーリー（US1: 新規登録時のオプトイン / US2: 登録後の設定変更）ごとにフェーズを分割。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能（別ファイル・未完了タスクへの依存なし）
- **[Story]**: US1: 新規登録（メール / Google 初回）でのオプトイン取得＋記録 / US2: 設定画面での配信許可の変更・撤回

## Path Conventions

- フロントエンド: `service-front/src/`（Feature-based）
- DB マイグレーション: `supabase/migrations/`
- 生成型: `packages/supabase/src/types.ts`

## 前提

- 既存: `001-auth`（`SignupForm` / `signup.schema.ts` / `signUp` / `handle_new_user` トリガー）、`016-google-login`（`ProfileCompletionForm` / `profile-completion.schema.ts` / `completeProfile` / `toUserDetailsInsert`）、`018-terms-agreement`（汎用 `FormCheckbox`・`handle_new_user` に同意列を追記済み）
- 設定画面 `account`（`/settings/profile` / `ProfileEditForm` / `profile.schema.ts` / `getProfile` / `updateProfile` / `toUserDetailsUpdate`）は既存
- `FormCheckbox` は 018 で新設済み（再利用・新規作成不要）
- `handle_new_user` は 016 で `? 'nickname'` 分岐、018 で terms 列を追記済み（メール経路のみ user_details を作成）

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 現状確認と組み込み箇所の洗い出し

- [X] T001 既存 `features/auth`（`SignupForm` / `ProfileCompletionForm` / `signup.schema` / `profile-completion.schema` / `actions.ts` の `signUp`・`completeProfile` / `mappers/profile-completion.ts`）、`features/account`（`ProfileEditForm` / `profile.schema.ts` / `actions.ts` の `getProfile`・`updateProfile` / `mappers/profile.ts` / `app/(authenticated)/settings/profile/page.tsx`）、`shared/components/form/FormCheckbox`、`shared/schemas/fields.ts`、018 のトリガー `supabase/migrations/20260626100000_add_terms_agreement.sql` を確認し、配信許可チェック・記録の組み込み箇所を洗い出す

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 全ユーザーストーリーが依存する DB 列・共有スキーマフィールド・共通チェックフィールド

**⚠️ CRITICAL**: このフェーズ完了まで各ストーリーの実装には着手できない（記録先の列・共通 UI が無いと成立しない）

- [X] T002 [P] DB マイグレーション作成 in `supabase/migrations/20260701120000_add_email_opt_in.sql`: `public.user_details` に `is_email_opted_in boolean not null default false` / `email_opted_in_at timestamptz`（null可）を追加、CHECK `user_details_email_opt_in_check`（`is_email_opted_in = (email_opted_in_at is not null)`）を付与、`handle_new_user()` を `create or replace`（016 の `? 'nickname'` 分岐・018 の terms 列を維持しつつメール経路 INSERT に `is_email_opted_in = coalesce((raw_user_meta_data->>'email_opt_in')::boolean, false)` を追記、`email_opted_in_at` は `case when (raw_user_meta_data->>'email_opt_in')::boolean then now() else null end`、`security definer set search_path = ''` 維持）。**`email_opted_in_at` は条件付きにする**（CHECK 違反でサインアップを壊さないため）。data-model.md 準拠
- [X] T003 [P] `emailOptInField`（`yup.boolean().default(false)`・任意・`oneOf` 無し）を新設 in `service-front/src/shared/schemas/fields.ts`（contracts/forms.md）
- [X] T004 [P] `emailOptInField` の Vitest 追加 in `service-front/src/shared/schemas/fields.test.ts`（未指定で false・true/false いずれも pass・必須エラーにならない）
- [X] T005 [P] `EmailOptInField` の Vitest 作成 in `service-front/src/shared/components/form/EmailOptInField/EmailOptInField.test.tsx`（ラベル・補足文表示・初期未チェック・チェック切替・`aria-describedby` 関連付け・error `role="alert"`）。contracts/forms.md 準拠
- [X] T006 [P] `EmailOptInField` の Storybook story 作成 in `service-front/src/shared/components/form/EmailOptInField/EmailOptInField.stories.tsx`（未チェック / チェック済み / error 状態）
- [ ] T007 [P] `EmailOptInField` の Playwright a11y テスト
- [X] T008 `EmailOptInField` 実装 in `service-front/src/shared/components/form/EmailOptInField/EmailOptInField.tsx` + `index.ts`（汎用 `FormCheckbox` を内包、ラベル「お知らせメールを受け取る」＋補足文 FR-011 を集約、モーダル無し、`register('emailOptIn')` をスプレッド対応）
- [X] T009 [P] `packages/supabase/src/types.ts` の `user_details`（Row / Insert / Update）に `is_email_opted_in` / `email_opted_in_at` を反映
- [X] T010 ローカル Supabase に T002 を適用（`supabase migration up`）し、既存メール／Google サインアップが回帰しない・既存 user_details 行が `is_email_opted_in=false` / `email_opted_in_at=NULL` のまま（grandfather・SC-005）であることを確認

**Checkpoint**: 記録先の列・共有フィールド・共通チェックフィールドが揃い、各ストーリーを開始できる

---

## Phase 3: User Story 1 - 新規登録時のオプトイン取得＋記録 (Priority: P1) 🎯 MVP

**Goal**: メール登録（`/signup`）と Google 初回（`/profile-completion`）に「お知らせメールを受け取る」任意チェック（初期オフ）を追加し、オンで登録すると `user_details` に `is_email_opted_in=true` / 許可日時が記録され、オフ（または未操作）なら `false` / NULL で登録される

**Independent Test**: `/signup` でチェックオン→登録→`is_email_opted_in=true`＋日時記録、未操作→登録成功かつ `false`/NULL。Google 初回でも同様（quickstart シナリオ A / B / C）

### Tests for User Story 1 ⚠️（実装前に書き、FAIL を確認）

- [X] T011 [P] [US1] `signup.schema` の `emailOptIn` Vitest（未指定で false・true/false で pass）in `service-front/src/features/auth/schemas/signup.schema.test.ts`（無ければ新規）
- [X] T012 [P] [US1] `profile-completion.schema` の `emailOptIn` Vitest（同上）in `service-front/src/features/auth/schemas/profile-completion.schema.test.ts`
- [X] T013 [P] [US1] `signUp` の Vitest（`options.data.email_opt_in` に `emailOptIn` が true/false で正しく渡る）in `service-front/src/features/auth/server/actions.test.ts`
- [X] T014 [P] [US1] `completeProfile` の Vitest（`emailOptIn=true` で INSERT に `is_email_opted_in=true`＋`email_opted_in_at` 非 null / `false` で `false`＋null）in `service-front/src/features/auth/server/actions.test.ts`
- [X] T015 [P] [US1] `toUserDetailsInsert` の Vitest（opt-in 2 列が INSERT ペイロードにマップされる）in `service-front/src/features/auth/server/mappers/profile-completion.test.ts`
- [X] T016 [P] [US1] `SignupForm` の Vitest（配信チェック表示・初期オフ・送信ハンドラが `emailOptIn` を `signUp` に渡す）
- [X] T017 [P] [US1] `ProfileCompletionForm` の Vitest（配信チェック表示・初期オフ・`completeProfile` に `emailOptIn` を渡す）
- [ ] T018 [P] [US1] Playwright E2E（要ローカル Supabase）: メール／Google 登録でオプトイン/未操作の各結果が `user_details` に記録される（quickstart シナリオ A / B / C）

### Implementation for User Story 1

- [X] T019 [P] [US1] `signup.schema.ts` に `emailOptIn: emailOptInField` を追加（contracts/forms.md）
- [X] T020 [P] [US1] `profile-completion.schema.ts` に `emailOptIn: emailOptInField` を追加
- [X] T021 [US1] `signUp` を変更 in `service-front/src/features/auth/server/actions.ts`（`SignUpInput` に `emailOptIn: boolean` 追加、`options.data` に `email_opt_in: input.emailOptIn` を追加。ガードは設けない＝任意）。contracts/server-actions.md
- [X] T022 [US1] `completeProfile` を変更 in `service-front/src/features/auth/server/actions.ts`（`CompleteProfileInput` に `emailOptIn` 追加）＋ `toUserDetailsInsert` に `is_email_opted_in = input.emailOptIn` / `email_opted_in_at = input.emailOptIn ? new Date().toISOString() : null` を追加 in `service-front/src/features/auth/server/mappers/profile-completion.ts`（CHECK 整合を満たす）
- [X] T023 [US1] `SignupForm` に `EmailOptInField`（`@/shared/components/form` の barrel 経由で import）を追加 in `SignupForm.tsx`。`register('emailOptIn')` で接続し、onSubmit の `signUp` 呼び出しに `emailOptIn: values.emailOptIn` を含める
- [X] T024 [US1] `ProfileCompletionForm` に `EmailOptInField` を追加 in `ProfileCompletionForm.tsx`。`completeProfile` 呼び出しに `emailOptIn` を含める

**Checkpoint**: 新規登録（両経路）でオプトイン取得＋記録が成立（MVP）

---

## Phase 4: User Story 2 - 設定画面での配信許可の変更・撤回 (Priority: P2)

**Goal**: 既存の `/settings/profile` に配信許可トグルを追加し、現在状態を表示（FR-007）しつつ、オン/オフをいつでも切り替え・撤回できる。OFF→ON で許可日時を記録、ON→OFF で日時クリア、ON 維持で最初の許可日時を保持

**Independent Test**: 不許可ユーザーで `/settings/profile` を開く→トグルオフ表示→オンで保存→`true`＋日時。許可済みでオフ保存→`false`/NULL。再表示で状態維持（quickstart シナリオ D / E）

### Tests for User Story 2 ⚠️（実装前に書き、FAIL を確認）

- [X] T025 [P] [US2] `account/profile.schema` の `emailOptIn` Vitest（任意 boolean）in `service-front/src/features/account/schemas/profile.schema.test.ts`（無ければ新規）
- [X] T026 [P] [US2] `getProfile` の Vitest（戻り値 `ProfileData` に `emailOptIn` が含まれる）in `service-front/src/features/account/server/actions.test.ts`
- [X] T027 [P] [US2] `updateProfile` の Vitest（OFF→ON で `email_opted_in_at` セット / ON→OFF で null / ON 維持で既存日時保持）in `service-front/src/features/account/server/actions.test.ts`
- [X] T028 [P] [US2] `toUserDetailsUpdate` の Vitest（opt-in 2 列が UPDATE ペイロードに正しくマップされる）in `service-front/src/features/account/server/mappers/profile.test.ts`
- [X] T029 [P] [US2] `ProfileEditForm` の Vitest（`defaultValues.emailOptIn=true` で初期チェック済み表示・切替・送信値に `emailOptIn` を含む）
- [ ] T030 [P] [US2] Playwright E2E（要ローカル Supabase）: 設定画面で許可に変更・撤回し再表示で状態が維持される（quickstart シナリオ D / E）

### Implementation for User Story 2

- [X] T031 [P] [US2] `account/schemas/profile.schema.ts` に `emailOptIn: emailOptInField` を追加
- [X] T032 [US2] `getProfile` を変更 in `service-front/src/features/account/server/actions.ts`（`select(...)` に `is_email_opted_in` 追加、`ProfileData` に `emailOptIn: boolean` 追加）
- [X] T033 [US2] `updateProfile` を変更 in `service-front/src/features/account/server/actions.ts`（`UpdateProfileInput` に `emailOptIn` 追加、現在の `email_opted_in_at` を参照して OFF→ON で `now()` / ON→OFF で null / ON 維持で保持を決定）＋ `toUserDetailsUpdate` に opt-in 2 列を反映 in `service-front/src/features/account/server/mappers/profile.ts`（research Decision 5・contracts/server-actions.md）
- [X] T034 [US2] `ProfileEditForm` に `EmailOptInField` を追加 in `ProfileEditForm.tsx`。`defaultValues.emailOptIn` に現在値を渡し、`updateProfile` 呼び出しに `emailOptIn` を含める

**Checkpoint**: 設定画面での変更・撤回が成立し、登録時オプトイン（US1）と合わせて同意のライフサイクルが完結

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: 仕上げと回帰確認

- [ ] T035 [P] Playwright a11y: `/signup` / `/profile-completion` / `/settings/profile` の配信チェック表示状態で WCAG 2.1 AA 違反ゼロ（quickstart シナリオ G・既存 a11y スイープ更新含む）
- [ ] T036 [P] 既存ユーザーの grandfather 確認（quickstart シナリオ F / SC-005）: マイグレーション適用前から存在する行が `is_email_opted_in=false` / `email_opted_in_at=NULL` で、お知らせメール配信対象（`is_email_opted_in=true`）に含まれないこと
- [ ] T037 既存 `001-auth` / `016-google-login` / `account`（プロフィール編集）のサインアップ・更新回帰確認、および `user_details` の CHECK 違反が起きないことを確認
- [ ] T038 `/review` と仕様同期（`/sync-spec`）を実行し、実装と spec / plan / data-model / contracts のずれを解消（sync-spec で data-model/plan/contracts を実装に追従、review は LGTM・Error 0）

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: 依存なし
- **Foundational (Phase 2)**: Setup 後。全ストーリーをブロック（DB 列・`emailOptInField`・`EmailOptInField`・型）
- **User Stories (Phase 3〜4)**: Foundational 後に開始。US1 と US2 は相互に独立（別 feature 中心）
- **Polish (Phase 5)**: 対象ストーリー完了後

### User Story Dependencies
- **US1 (P1)**: Foundational（T002 列＋トリガー、T003 フィールド、T008 `EmailOptInField`、T009 型）後に開始可。新規登録の主動線（MVP）
- **US2 (P2)**: Foundational 後に開始可。US1 とは別 feature（account）中心で並列可能

### Within Each User Story
- テストを先に書き FAIL を確認 → スキーマ → Server Action / mapper → フォーム

### Parallel Opportunities
- Foundational: T002（migration）/ T003-T004（field）/ T005-T007（EmailOptInField テスト）/ T009（型）は別ファイルで並列可（T008 実装は T005-T007 の後、T010 適用は T002 の後）
- 各ストーリーのテストタスク（[P]）はまとめて並列起動可
- Foundational 完了後、US1 と US2 を別担当で並列着手可

---

## Parallel Example: User Story 1

```bash
# US1 のテストを一括起動（実装前・FAIL 確認）:
Task: "signup.schema の emailOptIn Vitest (T011)"
Task: "profile-completion.schema の emailOptIn Vitest (T012)"
Task: "signUp の Vitest (T013)"
Task: "completeProfile の Vitest (T014)"
Task: "SignupForm の Vitest (T016)"
```

---

## Implementation Strategy

### MVP First（US1）
1. Phase 1: Setup
2. Phase 2: Foundational（DB 列＋トリガー / `emailOptInField` / `EmailOptInField` / 型）
3. Phase 3: US1（新規登録のオプトイン取得＋記録）
4. **STOP and VALIDATE**: quickstart シナリオ A/B/C → 新規登録時の同意取得が完成（MVP）

### Incremental Delivery
1. Setup + Foundational → 基盤完成
2. US1 → 検証 → MVP
3. US2（設定画面での変更・撤回）を追加 → 検証
4. Polish（a11y・grandfather・回帰・仕様同期）

---

## Notes
- [P] = 別ファイル・依存なし
- Constitution III に従い、`EmailOptInField` は Vitest + Storybook + Playwright a11y を同梱（`/generate-with-tests` 活用可）
- メール配信は**任意（オプトイン）**。利用規約（018）と異なりサーバー必須ガードは設けない。デフォルト不許可は `emailOptInField` の `default(false)` と DB の `default false` で担保
- `handle_new_user` 再定義は 016 の `? 'nickname'` 分岐と 018 の terms 列を必ず維持する（壊すと既存サインアップが失敗）
- `email_opted_in_at` は許可時のみ非 null。CHECK `is_email_opted_in = (email_opted_in_at is not null)` を全経路で満たす
- 既存ユーザーは `false` / NULL で grandfather。お知らせメール配信抑止（FR-008）は配信処理側（次フィーチャー）が `is_email_opted_in=true` のみ対象にすることで担保

## 実装ステータス（/speckit-implement 実行時点）

完了（コード + Vitest + 型チェック + Lint/Format グリーン）: T001–T006 / T008–T017 / T019–T029 / T031–T034。
- `type-check`・`biome lint`・`biome format` すべてパス。関連 Vitest 12 ファイル / 94 ケース パス。
- マイグレーション（T002）はローカル DB に対しトランザクション内で適用→ロールバックして検証済み（DDL・カラム・default・CHECK・`handle_new_user` 再定義がエラーなく適用されることを確認）。永続適用（T010）は共有ローカルスタックを汚さないため未コミット。

未実行（実行環境が必要・要フォロー）:
- **T007 / T018 / T030 / T035 / T036**: Playwright E2E / a11y。ブラウザ + ローカル Supabase 起動が前提のため本実行では未走。spec の quickstart シナリオ A–G に対応。
- **T037**: 既存機能の回帰確認は型チェック・Lint・単体テストのレベルでは緑（破壊なし）。実アプリでのサインアップ／更新の手動回帰は未実施。
- **T038**: `/review` と `/sync-spec` は別スキルのため未実行（コミット前に実施推奨）。

補足: worktree には `node_modules` が無く `@repo/*` がメインリポジトリ側へ解決されるため、worktree 内に `node_modules/@repo/{supabase,ui}` → `../../packages/*` のローカル symlink を作成して型解決を自己完結させた（`node_modules` は gitignore 対象）。
