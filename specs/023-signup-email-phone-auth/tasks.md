---

description: "Task list for 023 認証強化（確認メール本番配信 + SMS 2 要素認証）"
---

# Tasks: 認証強化（サインアップ確認メールの本番配信 + ログイン時 SMS 2 要素認証）

**Input**: Design documents from `specs/023-signup-email-phone-auth/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Constitution III（Test-First）に従い、サーバーアクション・スキーマ・UI コンポーネントにテストを同梱する（service-front はさらに Storybook）。config.toml / DNS / 外部プロバイダ設定はユニット不能のため quickstart の手動検証で担保する。

**Organization**: spec.md の User Story（US1=P1 / US2=P2）ごとにフェーズを分割。US1 と US2 は独立して実装・テスト・デプロイ可能。FR-016（管理者による 2FA 解除）は US2 のリカバリー経路として US2 フェーズに含める。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可（別ファイル・未完了タスクへの依存なし）
- **[Story]**: 対応 User Story（US1 / US2）。Setup / Foundational / Polish には付けない
- 各タスクに具体的なファイルパスを明記

## Path Conventions

Web アプリ（モノレポ）: `service-front/src/`、`admin-front/src/`、`supabase/`。plan.md の Project Structure に準拠。

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 両ストーリーで使う前提の整備

- [X] T001 [P] 新規環境変数を `.env.example` に追記・説明: メールは**既存 `RESEND_API_KEY` を Auth SMTP に再利用**（新規プロバイダ変数は追加せず）、`SUPABASE_AUTH_SMS_TWILIO_ACCOUNT_SID` / `SUPABASE_AUTH_SMS_TWILIO_MESSAGE_SERVICE_SID` / `SUPABASE_AUTH_SMS_TWILIO_AUTH_TOKEN`（service-front）、admin-front 用 `SUPABASE_SERVICE_ROLE_KEY`
- [X] T002 [P] `supabase/templates/` ディレクトリを用意（存在しない場合）し、日本語メールテンプレートの配置場所を確保

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 両ストーリーのテストで共有する基盤

**⚠️ CRITICAL**: 本フェーズ完了までユーザーストーリー実装のテストは書けない（共有モックに依存するため）

- [X] T003 [P] Supabase Auth モックヘルパー（`auth.resend` / `auth.mfa.*` / `auth.admin.mfa.*` をスタブ）を **各アプリ内に配置**する（service-front 側は `service-front/src/features/account/server/actions.test.ts` の既存パターンを基にテスト用ユーティリティ化、admin-front 側は同等のヘルパーを admin-front 内に用意）。両アプリは別パッケージのためクロスパッケージ共有はせず、各アプリで完結させる

**Checkpoint**: 基盤完了 — US1 / US2 を並行着手可能

---

## Phase 3: User Story 1 - 新規登録の確認メールが本番で届く (Priority: P1) 🎯 MVP

**Goal**: 本番環境でサインアップ確認メール（および全認証メール）を実受信箱へ確実に届け、再送導線を提供する（FR-001〜007a）。

**Independent Test**: 本番相当環境で実在アドレスで `/signup` を完了 → 確認メールが 2 分以内に届き、リンクから TOP（`/`）に到達。届かない場合は再送ボタンで再送できる（quickstart シナリオ 1）。

### Implementation for User Story 1

- [X] T004 [US1] `supabase/config.toml` の `[auth.email.smtp]` を有効化。**プロジェクト既存の Resend を SMTP 送信元に利用**（`host=smtp.resend.com` / `port=587` / `user=resend` / `pass=env(RESEND_API_KEY)` / `admin_email=env(CONTACT_MAIL_FROM)` / `sender_name="ダイビングログ"`）し、`[auth.email.template.confirmation]` で日本語テンプレートを参照。※ research.md の SendGrid 案は実コード確認の結果 Resend に変更（既存 email プロバイダに統一）
- [X] T005 [P] [US1] `supabase/templates/confirmation.html` を日本語で作成（件名・本文・確認リンク・サービス名。FR-003）
- [X] T006 [P] [US1] `resendConfirmationEmail` の Vitest テストを `service-front/src/features/auth/server/actions.test.ts` に追加（成功 / レート制限 / ユーザー列挙回避）。実装前に FAIL させる
- [X] T007 [US1] `resendConfirmationEmail(email)` を `service-front/src/features/auth/server/actions.ts` に実装（`supabase.auth.resend({ type:'signup', email, options:{ emailRedirectTo:'/api/auth/callback?next=/' }})`。契約: `contracts/service-front-email.md`。T006 に依存）
- [X] T008 [P] [US1] `ResendConfirmationButton` の Vitest + a11y テスト（`ResendConfirmationButton.test.tsx`）と Storybook story（`ResendConfirmationButton.stories.tsx`）を `service-front/src/features/auth/components/client/ResendConfirmationButton/` に作成（クールダウン中 `disabled`・`aria-live` 通知）。`/generate-with-tests` を利用可。Vitest/a11y は実装前に FAIL させる（Constitution III: service-front は Storybook 同梱必須）
- [X] T009 [US1] `ResendConfirmationButton` Client Component を `service-front/src/features/auth/components/client/ResendConfirmationButton/`（本体 + `index.ts`）に実装（T008 に依存）
- [X] T010 [US1] サインアップ完了状態（「確認メールを送信しました」）に再送ボタンを組み込む: `service-front/src/features/auth/components/client/SignupForm/SignupForm.tsx`（`ResendConfirmationButton email={sentTo}`）
- [X] T011 [US1] `/login?error=email_not_verified` 表示時に再送導線を追加: `service-front/src/app/(auth)/login/page.tsx`（宛先不明のため `ResendConfirmationButton`（email 未指定＝メール入力欄あり）を表示）
- [ ] T012 [US1] （運用・コード外）本番 DNS に Resend ドメイン認証（SPF/DKIM）と DMARC を設定し検証（FR-007 / SC-001）。手順は `quickstart.md` に記載
- [ ] T013 [US1] `quickstart.md` シナリオ 1 を実行して US1 を検証（到達 2 分以内 / 再送 / 期限切れリンク / リセットメール到達）

**Checkpoint**: US1 が単独で機能・検証可能（MVP）

---

## Phase 4: User Story 2 - ログイン時の SMS 2 要素認証 (Priority: P2)

**Goal**: 電話番号を登録して 2 要素認証を有効化し、ログイン時に SMS ワンタイムコードで 2 段階目を必須化する。無効化・管理者による解除（FR-016）も提供する（FR-008〜016）。

**Independent Test**: 設定画面で電話番号を登録・有効化 → 再ログインで 1 段階目成功後に SMS コード入力を要求され、正しいコードで TOP（`/`）到達。無効化で 2 段階目が消える。管理者はユーザー詳細から要素を解除できる（quickstart シナリオ 2・3）。

### Implementation for User Story 2

- [X] T014 [US2] `supabase/config.toml` の `[auth.mfa.phone]` を `enroll_enabled=true` / `verify_enabled=true`、`[auth.sms.twilio]` を `enabled=true` + `account_sid` / `message_service_sid` + `auth_token=env(SUPABASE_AUTH_SMS_TWILIO_AUTH_TOKEN)` に設定（`[auth.sms] enable_signup=false` は維持）
- [X] T015 [P] [US2] 電話番号（E.164）・OTP コードの検証スキーマ + テストを `service-front/src/features/mfa/schemas/`（本体 + `*.test.ts` + `index.ts`）に作成
- [X] T016 [P] [US2] MFA 全サーバーアクション（`enrollPhoneFactor` / `verifyPhoneFactor` / `disablePhoneFactor` / `getMfaStatus` / `challengeLoginFactor` / `verifyLogin`）の Vitest テストを `service-front/src/features/mfa/server/actions.test.ts` に作成（誤コード/期限切れ拒否・レート制限含む）。実装前に FAIL させる
- [X] T017 [US2] MFA サーバーアクションを `service-front/src/features/mfa/server/actions.ts` に実装（契約: `contracts/service-front-mfa.md`。`supabase.auth.mfa.enroll/challenge/verify/unenroll/listFactors`。T015・T016 に依存）
- [X] T018 [P] [US2] `TwoFactorSettings` の Vitest + a11y テスト（`TwoFactorSettings.test.tsx`）と Storybook story（`TwoFactorSettings.stories.tsx`）を `service-front/src/features/mfa/components/client/TwoFactorSettings/` に作成（有効化/無効化フロー・ラベル関連付け・`role="alert"`）。`/generate-with-tests` を利用可。Vitest/a11y は実装前に FAIL させる（Constitution III）
- [X] T019 [US2] `TwoFactorSettings` Client Component を `service-front/src/features/mfa/components/client/TwoFactorSettings/`（本体 + `index.ts`）に実装（電話番号入力 → コード確認で有効化、無効化ボタン。T018 に依存）
- [X] T020 [US2] 2 要素認証 設定ページを `service-front/src/app/(authenticated)/settings/two-factor/page.tsx` に作成し、既存 `settings` ナビ/一覧からリンク（`getMfaStatus` を初期表示に使用）
- [X] T021 [P] [US2] `MfaChallengeForm`（ログイン 2 段階目コード入力）の Vitest + a11y テスト（`MfaChallengeForm.test.tsx`）と Storybook story（`MfaChallengeForm.stories.tsx`）を `service-front/src/features/mfa/components/client/MfaChallengeForm/` に作成（誤コード再入力・再送クールダウン）。`/generate-with-tests` を利用可。Vitest/a11y は実装前に FAIL させる（Constitution III）
- [X] T022 [US2] `MfaChallengeForm` Client Component を `service-front/src/features/mfa/components/client/MfaChallengeForm/` に実装（`challengeLoginFactor` 再送・`verifyLogin`。T021 に依存）
- [X] T023 [US2] ログイン 2 段階目の導線（チャレンジ画面）を追加: `service-front/src/app/(auth)/login/verify/page.tsx`（1 段階目成功後・AAL2 未達時に遷移）
- [X] T024 [P] [US2] AAL2 ルートガード判定ロジック（`aal1→aal2` で遮断、`aal1→aal1` で素通り）の Vitest 単体テストを作成（純関数として切り出し `service-front/src/features/mfa/lib/aalGuard/`）。実装前に FAIL させる
- [X] T025 [US2] AAL2 強制を `service-front/src/proxy.ts`（middleware）に実装（enroll 済みで `aal1` の場合、保護ルートを 2 段階目チャレンジへ誘導。T024 のロジックを利用）
- [X] T026 [US2] AAL2 強制の二層目を `service-front/src/app/(authenticated)/layout.tsx` に追加（既存 email 未確認チェックの近傍。FR-010・FR-015 を厳守）
- [X] T027 [US2] admin-front のサービスロールクライアントを `admin-front/src/shared/lib/supabase/admin.ts`（`server-only`・`SUPABASE_SERVICE_ROLE_KEY`・`persistSession:false`）に新設（契約: `contracts/admin-front-mfa.md`）
- [~] T028 [US2] （**スキップ**）`admin_audit_logs.action` は CHECK で `create/update/soft_delete/hard_delete/restore` に固定。新規値は追加せず既存 `hard_delete` を再利用（`targetTable='mfa_factors'`）したため、マイグレーションは不要と判断しスキップ
- [X] T029 [P] [US2] `removeMfaFactor` の Vitest テストを `admin-front/src/features/users-admin/server/actions.test.ts` に作成（`requireAdmin` ガード・`listFactors→deleteFactor`・`recordAudit` 呼び出し・service_role クライアントはモック）。実装前に FAIL させる
- [X] T030 [US2] `removeMfaFactor(userId)`（+ 任意で `getUserMfaStatus`）を `admin-front/src/features/users-admin/server/actions.ts`（必要に応じ `queries.ts`）に実装（Admin API + `recordAudit`。T027・T029 に依存）
- [X] T031 [P] [US2] `RemoveMfaButton`（確認ダイアログ付き）の Vitest テストを `admin-front/src/features/users-admin/components/client/RemoveMfaButton/RemoveMfaButton.test.tsx` に作成（admin-front は Storybook 非採用: 本体 + テスト + `index.ts` の 3 点構成）。admin-front に Playwright+axe の a11y 基盤がある場合のみ a11y テストも追加。実装前に FAIL させる
- [X] T032 [US2] `RemoveMfaButton` を実装し、ユーザー詳細 `admin-front/src/app/(admin)/users/[id]/page.tsx` に組み込む（有効な要素が無いユーザーでは非表示/非活性。T031・T030 に依存）
- [ ] T033 [US2] `quickstart.md` シナリオ 2・3 を実行して US2 を検証（有効化 → 再ログイン 2 段階目 → 無効化、管理者による解除）

**Checkpoint**: US1・US2 がそれぞれ独立して機能・検証可能

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: 複数ストーリーに跨る仕上げ

- [ ] T034 [P] パスワードリセット（recovery）・メール変更（email_change）の日本語テンプレートを `supabase/templates/` に追加し、`supabase/config.toml` から参照（優先度低・Clarify Q2=A の補完）
- [X] T035 各フロントで `npm run check`（biome）・型チェック・Vitest を通し、命名/CSS/a11y 規約（`.claude/rules/`）準拠を確認
- [X] T036 `/review` と仕様同期（spec/plan と実装の整合）を実施し、`checklists/requirements.md` を再検証（2026-07-02: /review + /sync-spec 実施。contracts 3 件・plan・research・quickstart・data-model を実装に合わせて更新。requirements.md は全項目パス維持）
- [ ] T037 `quickstart.md` の全シナリオ + config/DNS チェックリストを本番相当環境で通し、SC-001/004/005/006 を確認

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし・即着手可
- **Foundational (Phase 2)**: Setup 後。共有モック（T003）は全ストーリーのテスト前提
- **User Stories (Phase 3・4)**: Foundational 後。US1 と US2 は相互依存なし → 並行可
- **Polish (Phase 5)**: 対象ストーリー完了後

### User Story Dependencies

- **US1 (P1)**: Foundational 後に単独完結（メール配信・再送）
- **US2 (P2)**: Foundational 後に単独完結。US1 とは独立（同じ `supabase/config.toml` を編集するが別セクション）

### Within Each Story

- テスト（`*.test.ts(x)`）を先に書き FAIL させてから実装（Constitution III）
- スキーマ → サーバーアクション → UI → ルート統合 → 検証 の順
- 同一ファイルを触るタスクは直列（例: config.toml の T004 と T014 は別セクションだが同一ファイルのため順に編集）

### Parallel Opportunities

- Setup の T001 / T002 は並列可
- US1 内: T005（テンプレート）・T006（action テスト）・T008（component テスト）は別ファイルで並列可
- US2 内: T015 / T016 / T018 / T021 / T024 / T029 / T031（いずれも別ファイルのテスト・スキーマ）は並列可
- Foundational 完了後、US1 と US2 は別担当で並行実装可能

---

## Parallel Example: User Story 2（テスト先行）

```bash
# US2 のテストを先に並列で作成（すべて別ファイル）:
Task: "T015 schema tests in service-front/src/features/mfa/schemas/"
Task: "T016 MFA action tests in service-front/src/features/mfa/server/actions.test.ts"
Task: "T018 TwoFactorSettings tests"
Task: "T021 MfaChallengeForm tests"
Task: "T024 AAL guard logic tests"
Task: "T029 removeMfaFactor tests (admin-front)"
Task: "T031 RemoveMfaButton tests (admin-front)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 を完了
4. **STOP & VALIDATE**: quickstart シナリオ 1 で US1 を単独検証
5. 本番へメール配信の改善をデプロイ（新規登録動線が完成）

### Incremental Delivery

1. Setup + Foundational → 基盤完成
2. US1（メール本番配信）→ 検証 → デプロイ（MVP）
3. US2（SMS 2FA + 管理者解除）→ 検証 → デプロイ
4. Polish（テンプレート整備・全体検証）

### Parallel Team Strategy

- Foundational 完了後、担当 A = US1、担当 B = US2（service-front MFA + admin-front 解除）で並行

---

## Notes

- [P] = 別ファイル・依存なし。[Story] ラベルはトレーサビリティ用
- `supabase/config.toml` は US1（メール）と US2（MFA/SMS）で別セクションを編集するが同一ファイルのため直列
- service_role キーはサーバー専用・`requireAdmin()` ガード内限定・監査必須（Constitution IV）
- 2FA 未有効化ユーザーの体験は不変（FR-015）を各テストで担保
- 各タスク/論理単位ごとにコミット（Conventional Commits）
