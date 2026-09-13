# Phase 1 Data Model: 認証強化（確認メール本番配信 + SMS 2 要素認証）

本フィーチャーは **`public` スキーマに新規テーブルを追加しない**。MFA の状態は Supabase が `auth` スキーマで管理し、確認メールは Supabase Auth が送信する。ここでは (a) アプリが参照・操作する外部エンティティ（auth スキーマ／設定）と、(b) 監査記録の使い方、(c) メールテンプレート資産を整理する。

## A. Supabase Auth 管理エンティティ（read/orchestrate のみ、DDL 対象外）

### auth.mfa_factors（Supabase 管理）

ユーザーに紐づく 2 要素認証の要素。本フィーチャーでは phone factor のみ扱う。

| 概念フィールド | 意味 | 備考 |
|----------------|------|------|
| id | 要素 ID | challenge/verify/delete のキー |
| user_id | 所有ユーザー | |
| factor_type | 要素種別 | 本フィーチャーは `phone` のみ |
| status | 状態 | `unverified`（enroll 直後） / `verified`（コード確認後に有効） |
| phone | 登録電話番号 | 国際形式（E.164）で保持される |
| friendly_name | 表示名 | 任意 |

- 操作: enroll（`mfa.enroll`）で `unverified` 作成 → challenge+verify で `verified` に昇格。disable はユーザー自身が `mfa.unenroll({ factorId })`、管理者は `auth.admin.mfa.deleteFactor`。
- スコープ制約: 本フィーチャーではユーザーあたり有効な phone 要素は実質 1 つ（複数要素の管理 UI はスコープ外。既存の重複要素があれば解除時に全 phone を対象とする）。

### auth.mfa_challenges（Supabase 管理）

ログイン 2 段階目または enroll 時に発行される SMS チャレンジ。

| 概念フィールド | 意味 | 備考 |
|----------------|------|------|
| id | チャレンジ ID | verify のキー |
| factor_id | 対象要素 | |
| （コード / 有効期限 / 検証状態） | OTP と失効管理 | Supabase 内部管理。`[auth.mfa.phone] otp_length=6` |

- 操作: `mfa.challenge({ factorId })` で SMS 送信 → `mfa.verify({ factorId, challengeId, code })` で消費。誤コード・期限切れは verify がエラー（FR-011）。

### 認証セッションの AAL（Assurance Level）

- `mfa.getAuthenticatorAssuranceLevel()` → `{ currentLevel, nextLevel }`。
- 2FA 未有効化: `currentLevel=aal1, nextLevel=aal1`（従来どおり、FR-015）。
- 2FA 有効化済みで 1 段階目のみ完了: `currentLevel=aal1, nextLevel=aal2` → 保護ルート遮断の判定条件。
- 2 段階目完了後: `currentLevel=aal2`。

## B. 確認/認証メール（Supabase Auth 送信、DDL 対象外）

| 概念 | 意味 | 属性 |
|------|------|------|
| サインアップ確認メール | 新規登録の本人確認 | 差出人（`sender_name`/`admin_email`）・件名・本文（確認リンク `emailRedirectTo=/api/auth/callback?next=/`）・有効期限（`[auth.email] otp_expiry`、既定 3600 秒） |
| パスワードリセット / メール変更メール | 同じ送信基盤で配信 | Clarify Q2=A により到達性は本フィーチャーの対象 |

## C. 設定・資産（本フィーチャーで変更するファイル）

| 対象 | 変更内容 |
|------|----------|
| `supabase/config.toml [auth.email.smtp]` | コメント解除・Resend 本番設定（`smtp.resend.com` / sender_name / admin_email=env / pass=env(RESEND_API_KEY)） |
| `supabase/config.toml [auth.mfa.phone]` | `enroll_enabled=true` / `verify_enabled=true` |
| `supabase/config.toml [auth.sms.twilio]` | `enabled=true` + `account_sid`/`message_service_sid`/`auth_token=env` |
| `supabase/config.toml [auth] / [auth.email]` | `secure_password_change=true`（再認証必須）・`[auth.email] max_frequency=60s`（メール爆撃対策・UI クールダウンと整合）に変更（2026-07-02 セキュリティ監査） |
| `supabase/templates/confirmation.html`（新規） | 日本語のサインアップ確認テンプレート |
| `supabase/templates/recovery.html` ほか（任意） | パスワードリセット等の日本語化（優先度低） |
| 環境変数 | `RESEND_API_KEY` / `CONTACT_MAIL_FROM` / `SUPABASE_AUTH_SMS_TWILIO_AUTH_TOKEN` / `SUPABASE_SERVICE_ROLE_KEY`（admin-front） |
| DNS（本番・コード外） | Resend ドメイン認証（SPF/DKIM）+ DMARC |

## D. 監査ログ（既存 `recordAudit` を利用）

- admin による MFA 要素解除（FR-016）は `admin-front/src/shared/lib/audit/recordAudit.ts` で記録する。
- 記録項目: 実行した管理者・対象ユーザー ID（`targetId`）・アクション種別 `hard_delete`（新規値は追加せず既存を再利用 / T028）・`targetTable: 'mfa_factors'`・削除した要素 ID 一覧（`changes.removedFactorIds`）・日時。
- 既存の監査テーブル定義に従う（本フィーチャーで監査テーブルの新規追加・enum 追加は不要と確定）。

## 新規マイグレーションの要否

- **不要（確定）**: MFA 状態は auth スキーマ管理、確認メールは Auth 管理、監査は既存テーブル。
- 監査アクション種別は既存の `hard_delete` を再利用したため、enum 追加のマイグレーションも不要と確定（T028 でスキップ済み）。
