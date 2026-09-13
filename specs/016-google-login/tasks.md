---
description: "Task list for 016-google-login implementation"
---

# Tasks: 認証（Google ログイン / ソーシャルログイン）

**Input**: Design documents from `/specs/016-google-login/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: 含める。Constitution III（Test-First / テスト同梱）に従い、`shared/components` / `features/*/components` は Vitest 単体テスト・Storybook story・Playwright a11y テストを必須同梱とする。スキーマ・Server Actions は Vitest、受け入れシナリオは Playwright E2E で検証する。

**Organization**: spec.md のユーザーストーリー（US1〜US4）ごとにフェーズを分割。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能（別ファイル・未完了タスクへの依存なし）
- **[Story]**: US1: Google でログイン / US2: 新規作成＋プロフィール補完 / US3: 既存メールとの自動紐付け / US4: ログアウト・認証ガード整合

## Path Conventions

- フロントエンド: `service-front/src/`（Feature-based アーキテクチャ）
- DB マイグレーション: `supabase/migrations/`
- Supabase 設定: `supabase/config.toml`

## 前提

- `service-front/src/features/auth` に既存実装あり（`signIn` / `signUp` / `signOut` / `requestPasswordReset`、`LoginForm` / `SignupForm`）
- `/api/auth/callback` は OAuth `code` を `exchangeCodeForSession` で処理済み（変更不要）
- `001-auth` の `signup.schema.ts` / `shared/constants/gender` を再利用できる
- Supabase ローカル環境が起動できる

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 現状確認と再利用ポイントの洗い出し

- [X] T001 既存 `service-front/src/features/auth` 構成（actions / schemas / components）と `service-front/src/app/api/auth/callback/route.ts` を確認し、OAuth で再利用できる箇所と不足を洗い出す

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 全ユーザーストーリーが依存する Google プロバイダ設定と DB スキーマ変更

**⚠️ CRITICAL**: このフェーズ完了まで Google ログイン（US1 含む）は成立しない。特に T003 のトリガー分岐が無いと初回 Google ログインが NOT NULL 制約違反で必ず失敗する

- [X] T002 [P] `supabase/config.toml` に `[auth.external.google]`（`enabled = true` / `client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"` / `secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"` / `skip_nonce_check = true`）を追加し、`service-front/.env.example` に 2 つの env キーを追記する（research.md Decision 6）
- [X] T003 DB マイグレーション作成 in `supabase/migrations/<ts>_alter_handle_new_user_for_oauth.sql`: `handle_new_user()` を `create or replace` し `public.users` 挿入は無条件・`public.user_details` 挿入は `new.raw_user_meta_data ? 'nickname'` のときのみに分岐（`security definer set search_path = ''` 維持）。併せて `user_details` に INSERT ポリシー `users can insert own details`（`with check ((select auth.uid()) = user_id)`）を追加（data-model.md 変更1・変更2）
- [ ] T004 ローカル Supabase を再起動（`supabase stop && supabase start`）し `supabase migration up` で T003 を適用、既存メールサインアップが従来どおり `user_details` を作成することを確認（回帰確認）

**Checkpoint**: Google プロバイダ設定とスキーマ準備完了 — 各ユーザーストーリーの実装を開始できる

---

## Phase 3: User Story 1 - Google でログイン (Priority: P1) 🎯 MVP

**Goal**: `/login` `/signup` から「Google でログイン」で認証フローを開始し、既存（補完済み）ユーザーがパスワード入力なしで TOP（`/`）に到達できる

**Independent Test**: 補完済みの Google アカウントでログアウト → `/login` の「Google でログイン」→ 同意 → 補完を挟まず TOP（`/`）に到達（quickstart シナリオ B）

### Tests for User Story 1 ⚠️（実装前に書き、FAIL を確認）

- [X] T005 [P] [US1] `signInWithGoogle` の Vitest 単体テスト（`signInWithOAuth` 呼び出し引数・`redirectTo`・失敗時の `actionFailure`）in `service-front/src/features/auth/server/actions.test.ts`
- [X] T006 [P] [US1] `GoogleAuthButton` の Vitest 単体テスト in `service-front/src/features/auth/components/client/GoogleAuthButton/GoogleAuthButton.test.tsx`
- [X] T007 [P] [US1] `GoogleAuthButton` の Storybook story in `service-front/src/features/auth/components/client/GoogleAuthButton/GoogleAuthButton.stories.tsx`
- [ ] T008 [P] [US1] `GoogleAuthButton` の Playwright a11y テスト（アクセシブル名・アイコン `aria-hidden`）
- [ ] T009 [P] [US1] Playwright E2E: 既存 Google ユーザーのログイン → TOP（`/`）到達（quickstart シナリオ B / SC-001）

### Implementation for User Story 1

- [X] T010 [US1] `signInWithGoogle()` Server Action 実装 in `service-front/src/features/auth/server/actions.ts`（`signInWithOAuth({ provider: 'google', options: { redirectTo: '{SITE_URL}/api/auth/callback?next=/' } })` → `data.url` へ `redirect()`、`url` 空は `actionFailure`）。contracts/server-actions.md 準拠
- [X] T011 [P] [US1] `GoogleAuthButton` コンポーネント実装 in `service-front/src/features/auth/components/client/GoogleAuthButton/GoogleAuthButton.tsx` + `index.ts`（`signInWithGoogle` を呼ぶ最小 Client、`aria-busy` 対応）
- [X] T012 [US1] `/login` ページ / `LoginForm` に `GoogleAuthButton` を配置 in `service-front/src/features/auth/components/client/LoginForm/LoginForm.tsx`
- [X] T013 [US1] `/signup` ページ / `SignupForm` に `GoogleAuthButton`（「Google で続行」）を配置 in `service-front/src/features/auth/components/client/SignupForm/SignupForm.tsx`
- [X] T013a [US1] キャンセル / 失敗時メッセージ機構の実装（FR-009 / U1 対応）: `service-front/src/app/api/auth/callback/route.ts` を `error` クエリ転送に拡張（`code` 無し + `error` あり → `/login?error=oauth_cancelled`、`code` 無し + `error` 無し → `/login`）し、`LoginForm` が `error` クエリに応じた文言（例:「Google ログインがキャンセルされました」/「ログインに失敗しました」）を `role="alert"` で表示する

**Checkpoint**: 補完済み Google ユーザーがログインでき、キャンセル / 失敗時は `/login` で理由が表示される（初回ユーザーの補完は US2 で成立）

---

## Phase 4: User Story 2 - Google で新規アカウント作成（初回ログイン） (Priority: P1)

**Goal**: 未登録 Google アカウントの初回ログインでアカウントが作成され、`/profile-completion` で全プロフィール項目を必須入力してから TOP（`/`）に到達できる

**Independent Test**: 未登録 Google アカウントでログイン → `/profile-completion` にリダイレクト → 全項目入力で送信 → TOP（`/`）到達。必須未入力では進めない（quickstart シナリオ A / US2-2・US2-3）

### Tests for User Story 2 ⚠️（実装前に書き、FAIL を確認）

- [X] T014 [P] [US2] `profile-completion.schema` の Vitest（必須未入力・ローマ字バリデーション・生年月日範囲・性別 3 値・身長体重 null 正規化）in `service-front/src/features/auth/schemas/profile-completion.schema.test.ts`（contracts/profile-completion-schema.md）
- [X] T015 [P] [US2] `completeProfile` の Vitest（yup 再検証・`user_details` INSERT 引数・成功で TOP（`/`）・補完済み再送の冪等扱い）in `service-front/src/features/auth/server/actions.test.ts`
- [X] T016 [P] [US2] `ProfileCompletionForm` の Vitest 単体テスト
- [X] T017 [P] [US2] `ProfileCompletionForm` の Storybook story
- [ ] T018 [P] [US2] `ProfileCompletionForm` の Playwright a11y テスト（label 関連付け・`role="alert"`・`aria-invalid`・`aria-required`）
- [ ] T019 [P] [US2] Playwright E2E: 初回 Google ログイン → 補完 → TOP（`/`）、および必須未入力で拒否（quickstart シナリオ A）
- [ ] T019a [P] [US2] Playwright E2E: メール未確認の Google アカウントでログインが拒否され、メール確認が必要である旨が表示されることを検証（FR-006 / US2-4 / C1 対応）

### Implementation for User Story 2

- [X] T020 [US2] `profile-completion.schema.ts` 実装 in `service-front/src/features/auth/schemas/profile-completion.schema.ts`（`signup.schema.ts` からメール/パスワードを除く共通プロフィール項目を抽出・共有。`CompleteProfileInput` 型を `InferType` で導出）
- [X] T021 [US2] `completeProfile(input)` Server Action 実装 in `service-front/src/features/auth/server/actions.ts`（サーバ側 yup 再検証 → `public.user_details` に `user_id = (select auth.uid())` で INSERT → TOP（`/`）。一意制約違反時は TOP（`/`）へ redirect）。contracts/server-actions.md 準拠
- [X] T022 [P] [US2] `ProfileCompletionForm` コンポーネント実装 in `service-front/src/features/auth/components/client/ProfileCompletionForm/ProfileCompletionForm.tsx` + `index.ts`（React Hook Form + `profile-completion.schema`、`gender` は `GENDER_OPTIONS`）
- [X] T023 [US2] `/profile-completion` ページ実装 in `service-front/src/app/(onboarding)/profile-completion/page.tsx`（補完ゲートのループ回避のため (authenticated) ではなく (onboarding) グループに配置。ページ内で「未認証→/login」「補完済み→TOP（/）」を自前ガード。`ProfileCompletionForm` を表示）
- [X] T024 [US2] `service-front/src/proxy.ts` に `/profile-completion` を認証必須ルートとして追加（未認証 → `/login`）
- [X] T025 [US2] `service-front/src/app/(authenticated)/layout.tsx` に補完ゲート実装（ログインユーザーの `user_details` 行を 1 回 SELECT → 無ければ `/profile-completion` へ `redirect()`。補完済みが `/profile-completion` を開いたら TOP（`/`）へ戻す）。FR-005 / FR-015 / research.md Decision 4
- [X] T025a [US2] メール未確認 Google アカウントのログイン拒否（FR-006 / C1 対応）: callback または `(authenticated)/layout.tsx` でセッションユーザーの `email_confirmed_at` / provider のメール確認状態を判定し、未確認なら `signOut()` のうえ `/login?error=email_not_verified` へ誘導する。Supabase が Google を常に確認済み扱いする場合は、その挙動を T004 で確認のうえ本タスクを「確認済み前提の防御的ガード + 検証」に縮小してよい（spec Assumptions 参照）

**Checkpoint**: Google 初回ユーザーが補完を経て利用開始でき、未確認メールは拒否される（US1 + US2 で Google ログインの主動線が完成）

---

## Phase 5: User Story 3 - 既存メールアカウントとの自動紐付け (Priority: P2)

**Goal**: メール＋パスワード登録済みと同一メールの Google ログインで、重複アカウントを作らず既存ユーザーとしてログインさせる

**Independent Test**: メール確認済みの既存ユーザーと同一メールの Google でログイン → 新規アカウントが作られず既存ログ履歴が見える（quickstart シナリオ C / SC-004）

> 実装は Supabase の自動アイデンティティ紐付け（確認済みメール一致時の既定動作）に委譲し、アプリ側のコード追加はしない（research.md Decision 5）。本フェーズは検証が中心。

### Tests for User Story 3 ⚠️

- [ ] T026 [P] [US3] Playwright E2E: 同一メール（確認済み）の Google ログインで重複アカウントが作られず、既存 `user_details` と履歴が維持され補完を挟まないことを検証（quickstart シナリオ C）

### Implementation for User Story 3

- [ ] T027 [US3] 自動紐付けの**実挙動を実環境で必ず確認する**（I1 対応）: 確認済みメールの既存ユーザーと同一メールの Google ログインで、新規 `auth.users` が作られず既存 identity に紐付くことを Supabase Studio / `auth.identities` で確認。`enable_manual_linking` 等が自動紐付けに影響しないことも確認する。**もし自動紐付けが効かない場合**は代替（手動 `linkIdentity` フロー、または同一メール時はログイン拒否＋既存ログイン方法の案内）を plan に追記して再設計する。research.md Decision 5
- [ ] T027a [US3] FR-007 の受け入れゲート: T026 の E2E（重複なし・履歴維持）が通ることをマージ条件とする

**Checkpoint**: 同一メールでもアカウントが一意に保たれる

---

## Phase 6: User Story 4 - ログアウトと認証ガードの整合 (Priority: P2)

**Goal**: Google ログインのセッションが既存の認証ガード・ログアウトと矛盾なく動く

**Independent Test**: Google ログイン → ログアウト → `/login`、未認証で `/dives` → `/login`、Google ログイン済みで `/login` `/signup` → TOP（`/`）（quickstart シナリオ E / SC-005）

### Tests for User Story 4 ⚠️

- [ ] T028 [P] [US4] Playwright E2E: Google ログイン → ログアウト → `/login` リダイレクト（FR-011）
- [ ] T029 [P] [US4] Playwright E2E: Google ログイン済みで `/login` `/signup` → TOP（`/`）、未認証で `/dives` 配下 → `/login`、未認証で `/profile-completion` → `/login`（FR-012 / FR-013 / T024）

### Implementation for User Story 4

- [ ] T030 [US4] 既存 `signOut` / `proxy.ts` の挙動が Google セッションでも成立することを確認し、不足があれば調整（基本は既存挙動の踏襲・新規実装なし）

**Checkpoint**: 認証境界が全ログイン方式で一貫

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 横断的な仕上げと回帰確認

- [X] T031 [P] `service-front/src/features/auth/index.ts` のエクスポートに `GoogleAuthButton` / `ProfileCompletionForm` / `completeProfile` / `signInWithGoogle` / `profile-completion.schema` を追加
- [ ] T032 [P] Playwright E2E: キャンセル / コールバック失敗の検証（quickstart シナリオ D / FR-009 / FR-010）: キャンセル → `/login?error=oauth_cancelled` で文言表示（T013a）、不正 `code` → `/login?error=auth_callback_failed`
- [ ] T032a [P] Playwright E2E: Google 作成済みのメールアドレスでメール + パスワードのサインアップを試み、「このメールアドレスは既に登録されています」が表示されることを検証（FR-008 / C2 対応）
- [ ] T033 既存 `001-auth`（メール＋パスワードのサインアップ / ログイン / リセット）の E2E が回帰していないことを確認
- [ ] T034 `quickstart.md` のシナリオ A〜E を一通り手動実行し、前提（Google OAuth クライアント発行・リダイレクト URI 登録・env 設定）を含めて検証
- [ ] T035 `/review` と仕様同期（`sync-spec`）を実行し、実装と spec / plan / data-model のずれを解消

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし・即開始可
- **Foundational (Phase 2)**: Setup 後。全ユーザーストーリーをブロックする（特に T003）
- **User Stories (Phase 3〜6)**: Foundational 完了後に開始
- **Polish (Phase 7)**: 対象ストーリー完了後

### User Story Dependencies

- **US1 (P1)**: Foundational 後に開始可。単独でログイン開始導線を検証できる
- **US2 (P1)**: Foundational 後に開始可。US1 の `GoogleAuthButton` を入口に使うが、補完フロー自体は独立してテスト可能。MVP は US1 + US2 で成立
- **US3 (P2)**: Foundational 後に検証可。新規コードなし（Supabase 既定動作）。実質 US2 完了後に E2E 検証
- **US4 (P2)**: Foundational 後に検証可。既存ガードの踏襲確認が中心

### Within Each User Story

- テストを先に書き FAIL を確認 → スキーマ → Server Action → コンポーネント → ページ / レイアウト統合
- US2 は T020（schema）→ T021（action）/ T022（form）→ T023（page）→ T024（proxy）→ T025（layout gate）の順

### Parallel Opportunities

- T002 と T003 は別ファイルのため並列可（ただし T004 適用前に両方完了）
- 各ストーリーのテストタスク（[P]）はまとめて並列実行可
- US1 と US2 は Foundational 完了後、別担当で並列着手可（US2 は US1 の `GoogleAuthButton` 完成を入口として待つのが安全）

---

## Parallel Example: User Story 1

```bash
# US1 のテストを一括起動（実装前・FAIL 確認）:
Task: "signInWithGoogle の Vitest (T005)"
Task: "GoogleAuthButton の Vitest (T006)"
Task: "GoogleAuthButton の Storybook (T007)"
Task: "GoogleAuthButton の Playwright a11y (T008)"
Task: "既存 Google ユーザーログインの E2E (T009)"
```

---

## Implementation Strategy

### MVP First（US1 + US2）

1. Phase 1: Setup
2. Phase 2: Foundational（T003 のトリガー分岐が最重要）
3. Phase 3: US1（ログイン導線）→ Phase 4: US2（初回作成＋補完）
4. **STOP and VALIDATE**: quickstart シナリオ A・B を検証 → Google ログインの主動線が完成（MVP）
5. デモ可能

### Incremental Delivery

1. Setup + Foundational → 基盤完成
2. US1 → US2 → シナリオ A/B 検証 → MVP デモ
3. US3（自動紐付け検証）→ US4（ガード整合検証）
4. Polish（キャンセル/失敗・回帰・仕様同期）

---

## Notes

- [P] = 別ファイル・依存なし
- Constitution III に従い、コンポーネントは Vitest + Storybook + Playwright a11y を同梱（`/generate-with-tests` を活用可）
- 既存 `signIn` / `signUp` / `signOut` / `requestPasswordReset` と `/api/auth/callback` は変更しない（US1 で参照のみ）
- `user_details` の NOT NULL / CHECK は弱めない（補完フォームが全項目を集める）
- 各チェックポイントでストーリー単独の動作を検証してから次へ進む
- FR-014（本人のみアクセス）は `001-auth` の既存 RLS（`users` / `user_details` の SELECT/UPDATE 本人限定）で担保される。Google ユーザーも同じポリシー配下に入るため新規実装は不要。T026 / T029 の E2E で他人データが見えないことを軽く確認する（G1 対応）
