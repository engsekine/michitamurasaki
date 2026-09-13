# Tasks: 認証（メール + パスワード）

**Input**: Design documents from `/specs/001-auth/`

**Prerequisites**: plan.md, spec.md, data-model.md

**Tests**: 元仕様でテストタスクが明示されているため含める。

**Organization**: ユーザーストーリー（spec.md の US1〜US4）ごとにフェーズを分割。チェック状態は元仕様の進捗を保持している（旧タスク番号を括弧で併記）。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能（別ファイル・依存なし）
- **[Story]**: 対応するユーザーストーリー（US1: サインアップ / US2: ログイン・ログアウト / US3: 認証ガード / US4: パスワードリセット）

## Path Conventions

- フロントエンド: `service-front/src/`（Feature-based アーキテクチャ）
- DB マイグレーション: `supabase/migrations/`

## 前提

- `service-front` に既存の `features/auth` 雛形あり（要確認）
- `@repo/supabase` 利用可能
- Supabase ローカル環境が起動できる

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 現状調査と不足の洗い出し

- [x] T001 既存 `service-front/src/features/auth` の現状を確認し不足を洗い出す（旧 T1）

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 全ユーザーストーリーが依存するスキーマ・Server Actions

**⚠️ CRITICAL**: このフェーズ完了までユーザーストーリーの実装には着手できない

- [x] T002 yup スキーマ作成（login / signup / reset）in `service-front/src/features/auth/schemas/{login,signup,reset}.schema.ts`（旧 T2）
- [x] T003 Server Actions 実装（signIn / signUp / signOut / requestPasswordReset）in `service-front/src/features/auth/server/actions.ts`（旧 T3）

**Checkpoint**: Foundation ready - ユーザーストーリーの実装を並列で開始できる

---

## Phase 3: User Story 1 - サインアップ (Priority: P1) 🎯 MVP

**Goal**: メール確認フローを含むアカウント作成の動線を成立させる

**Independent Test**: `/signup` でフォーム送信 → Inbucket で確認メールのリンクをクリック → TOP（`/`）に到達できること

### Implementation for User Story 1

- [x] T004 [US1] `/signup` ページ実装 in `service-front/src/app/(auth)/signup/page.tsx` + `service-front/src/features/auth/components/client/SignupForm/`（旧 T5）
- [x] T005 [US1] メール確認コールバック実装 in `service-front/src/app/api/auth/callback/route.ts`（旧 T10）

**Checkpoint**: サインアップ → メール確認 → TOP（`/`）到達が単独で検証可能

---

## Phase 4: User Story 2 - ログイン / ログアウト (Priority: P2)

**Goal**: 既存ユーザーのログインとログアウトの動線を成立させる

**Independent Test**: 確認済みアカウントで `/login` → TOP（`/`）→ ログアウト → `/login` の一連を確認できること

### Implementation for User Story 2

- [x] T006 [P] [US2] `/login` ページ実装 in `service-front/src/app/(auth)/login/page.tsx` + `service-front/src/features/auth/components/client/LoginForm/`（旧 T4）
- [x] T007 [P] [US2] ヘッダーにログアウトボタン（既存 `AuthNav` で実装済み）in `service-front/src/features/auth/components/client/AuthNav/`（旧 T11）

**Checkpoint**: ログイン・ログアウトが単独で検証可能

---

## Phase 5: User Story 3 - 認証ガード (Priority: P2)

**Goal**: 認証必須ルートの保護と、認証済みユーザーの認証ページからの排除

**Independent Test**: 未認証で `/dives` → `/login` リダイレクト、認証済みで `/login` `/signup` → TOP（`/`）リダイレクトを確認できること

### Implementation for User Story 3

- [x] T008 [US3] ミドルウェアで認証必須グループ配下を保護 in `service-front/src/proxy.ts`（旧 T8）
- [x] T009 [US3] 認証済みユーザーが `(auth)` 配下に来たら TOP（`/`）へリダイレクト in `service-front/src/proxy.ts`（旧 T9）

**Checkpoint**: 認証ガードが単独で検証可能

---

## Phase 6: User Story 4 - パスワードリセット (Priority: P3)

**Goal**: メール経由のパスワードリセット動線を成立させる

**Independent Test**: `/reset-password` で送信 → Inbucket のリセットメールから新パスワード設定 → `/login` リダイレクトを確認できること

### Implementation for User Story 4

- [x] T010 [US4] `/reset-password` ページ実装 in `service-front/src/app/(auth)/reset-password/page.tsx` + `service-front/src/features/auth/components/client/ResetPasswordForm/`（旧 T6）
- [X] T011 [US4] パスワード再設定ページ（リセットリンクから飛ぶページ）実装（2026-07-02 完了: `/update-password` + `UpdatePasswordForm` + `updatePassword`。旧 T7）

**Checkpoint**: パスワードリセットが単独で検証可能（T011 完了後）

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: テストと受け入れ確認

- [ ] T012 [P] yup スキーマ単体テスト in `service-front/src/features/auth/schemas/`（旧 T12）
- [ ] T013 [P] Server Actions 単体テスト in `service-front/src/features/auth/server/`（旧 T13）
- [ ] T014 E2E テスト（サインアップ → ログイン → ログアウト → リセット）（旧 T14）

---

## 受け入れ確認

- [ ] spec.md の全受け入れ条件を Playwright で再現
- [ ] 未認証で `/dives` にアクセス → `/login` リダイレクト
- [ ] 認証済みで `/login` にアクセス → TOP（`/`）リダイレクト
- [ ] パスワードリセットメールが Inbucket（ローカル）に届く

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし
- **Foundational (Phase 2)**: Phase 1 完了後。全ユーザーストーリーをブロックする
- **User Stories (Phase 3〜6)**: Phase 2 完了後、並列実行可能（優先度順なら P1 → P2 → P3）
- **Polish (Phase 7)**: 対象ユーザーストーリーの完了後

### User Story Dependencies

- **US1 サインアップ (P1)**: Foundational 完了後に着手可能。他ストーリーへの依存なし
- **US2 ログイン / ログアウト (P2)**: Foundational 完了後に着手可能。検証にはメール確認済みアカウントが必要（US1 のフローまたは Supabase 管理画面で用意）
- **US3 認証ガード (P2)**: Foundational 完了後に着手可能。検証には認証済みセッションが必要
- **US4 パスワードリセット (P3)**: Foundational 完了後に着手可能。他ストーリーへの依存なし

### Parallel Opportunities

- T006 / T007 は別ファイルのため並列可
- T012 / T013 は別ファイルのため並列可
- Phase 2 完了後、US1〜US4 は別担当者による並列実装が可能

---

## Implementation Strategy

1. Phase 1〜2（Setup + Foundational）を完了させる — 完了済み
2. US1（サインアップ）を MVP として単独検証 — 完了済み
3. US2 / US3 / US4 を順次追加 — 完了（T011 は 2026-07-02 対応）
4. Phase 7 のテスト（T012〜T014）と受け入れ確認を実施 — 未着手

---

## Notes

- [P] タスク = 別ファイル・依存なし
- 各ユーザーストーリーは独立して完了・検証できること
- チェック状態は移行元仕様の進捗を反映している
