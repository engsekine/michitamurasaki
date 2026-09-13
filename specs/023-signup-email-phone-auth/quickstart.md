# Quickstart / 検証ガイド: 認証強化（確認メール本番配信 + SMS 2 要素認証）

本フィーチャーは config・DNS・外部プロバイダを含むためユニットテストだけでは完結しない。以下の手動シナリオで end-to-end を検証する。詳細な型・処理は [contracts/](./contracts/) と [data-model.md](./data-model.md) を参照。

## 前提

- Supabase プロジェクト（本番/ステージング、MFA phone は Pro プラン）。
- 環境変数: `RESEND_API_KEY`、`CONTACT_MAIL_FROM`、`SUPABASE_AUTH_SMS_TWILIO_AUTH_TOKEN`、admin-front 用 `SUPABASE_SERVICE_ROLE_KEY`。
- Resend: ドメイン認証（SPF/DKIM）投入済み + DMARC。Twilio: 送信可能な番号/Messaging Service。
- ローカルはユニット/コンポーネントテスト用。メール到達・SMS は Inbucket / `[auth.sms.test_otp]` で擬似検証できる。

## シナリオ 1: 本番で認証メールが届く（US1）

1. 本番相当環境で `/signup` を実在アドレスで完了。
2. **期待**: 数分以内（目標 2 分以内 / SC-001）に受信箱へ日本語の確認メールが届く。差出人が本サービス名義（迷惑メール振り分けされない）。
3. メール内リンク → `/api/auth/callback` 経由で TOP（`/`）に到達（Acceptance US1-2）。
4. 「確認メールを送信しました」画面で **再送ボタン** を押す → 再送される。連打はクールダウンで抑止（US1-4 / FR-005）。
5. 期限切れリンクを開く → `/login?error=auth_callback_failed`（US1-5）。
6. パスワードリセットを実行 → リセットメールも届く（Clarify Q2=A / FR-007a）。

### 自動テスト
- `resendConfirmationEmail` のサーバーアクションを Vitest でモック検証（成功/レート制限/列挙回避）。

## シナリオ 2: SMS 2 要素認証の有効化と再ログイン（US2）

1. ログイン済みで `/settings/two-factor` を開く → 電話番号を入力し有効化要求（`enrollPhoneFactor`）。
2. **期待**: SMS でコード受信 → コード入力（`verifyPhoneFactor`）で有効化（Acceptance US2-1）。
3. ログアウト → 再ログイン（メール/パスワード or Google）。1 段階目成功後、TOP（`/`）に入れず **2 段階目コード入力** を要求される（US2-2）。
4. 正しいコード入力 → TOP（`/`）到達（US2-3）。誤コード/期限切れ → 拒否・再入力（US2-4）。届かない場合は再送（US2-5 / FR-012）。
5. `/settings/two-factor` で無効化（`disablePhoneFactor`）→ 次回ログインは 2 段階目なし（US2-6）。
6. 2FA 未有効化の別アカウントでログイン → 手順・所要時間が従来どおり（FR-015 / SC-006）。

### 自動テスト
- `enrollPhoneFactor` / `verifyPhoneFactor` / `disablePhoneFactor` のサーバーアクションを Vitest でモック検証。
- ルートガードの AAL 分岐（`aal1→aal2` で遮断、`aal1→aal1` で素通り）を単体で検証。
- 設定画面フォーム・コード入力 UI に Vitest + a11y（+ service-front は Storybook）を同梱。

## シナリオ 3: 管理者による 2 要素認証の解除（FR-016）

1. 上記でユーザーに 2FA を有効化しておく。
2. admin-front でそのユーザーの詳細（`(admin)/users/[id]`）を開く → 「2 要素認証を解除」を実行（確認ダイアログ）。
3. **期待**: `removeMfaFactor` が Admin API で phone 要素を削除し、監査ログに記録される。
4. 対象ユーザーで再ログイン → 2 段階目を求められない（解除成功）。必要なら再登録できる。

### 自動テスト
- `removeMfaFactor` を Vitest で検証（`requireAdmin` ガード、`listFactors`→`deleteFactor`、`recordAudit` 呼び出し）。service_role クライアントはモック。

## config / DNS チェックリスト（ユニット不能・手動）

- [ ] `supabase/config.toml [auth.email.smtp] enabled=true`（Resend、sender_name / admin_email=env(CONTACT_MAIL_FROM) 設定）
- [ ] `supabase/templates/confirmation.html`（日本語）反映
- [ ] SPF / DKIM / DMARC レコード投入済み・検証パス
- [ ] `[auth.mfa.phone] enroll_enabled=true / verify_enabled=true`
- [ ] `[auth.sms.twilio] enabled=true` + 本番 SID / Messaging Service / `auth_token=env`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` を admin-front サーバー環境にのみ設定（クライアント露出なし）

## 完了判定

- SC-001（メール 2 分以内 99%）・SC-004（SMS 30 秒以内）・SC-005（誤コード 100% 拒否）・SC-006（未有効化ユーザー不変）を上記シナリオで確認できること。
