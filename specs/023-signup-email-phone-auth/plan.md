# Implementation Plan: 認証強化（サインアップ確認メールの本番配信 + ログイン時 SMS 2 要素認証）

**Branch**: `023-signup-email-phone-auth` | **Date**: 2026-07-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/023-signup-email-phone-auth/spec.md`

## Summary

既存の Supabase Auth（001-auth メール/パスワード、016-google-login）を土台に、2 つの独立した価値を追加する。

1. **認証メールの本番配信（US1）**: `supabase/config.toml` の `[auth.email.smtp]` を本番 SMTP 送信元（Resend）に設定し、送信者認証（SPF/DKIM/DMARC）を整えて、サインアップ確認・パスワードリセット・メール変更などの全認証メールを実受信箱へ届ける。加えて日本語のメールテンプレートと「確認メール再送」導線を追加する。
2. **SMS 2 要素認証（US2）**: `[auth.mfa.phone]` と `[auth.sms.twilio]` を有効化し、設定画面で電話番号を登録・有効化（enroll → challenge → verify）、ログイン時に AAL1→AAL2 の昇格をルートガードで強制、設定画面から無効化できるようにする。電話紛失時は admin-front から管理者が要素を解除する（サービスロール経由 + 監査ログ）。

技術方針は「Supabase が管理する認証機能（auth スキーマの `mfa_factors` / `mfa_challenges`、確認メール送信）をアプリ側から orchestrate する」形を取り、`public` スキーマへの新規テーブル追加は行わない。

## Technical Context

**Language/Version**: TypeScript（strict）/ Next.js App Router（React 19 + React Compiler）

**Primary Dependencies**: Supabase（`@supabase/ssr` + `supabase-js`）、React Hook Form + 既存 `features/*/schemas/` の検証慣習に準拠

**Storage**: Supabase PostgreSQL + Supabase Auth。MFA の要素・チャレンジは **auth スキーマ（`auth.mfa_factors` / `auth.mfa_challenges`）で Supabase が管理**するため、本フィーチャーで `public` スキーマに新規テーブルは作らない見込み。監査ログは既存の `public` 監査テーブル（`recordAudit`）を利用

**Testing**: Vitest（サーバーアクション・スキーマ単体）、Storybook（service-front コンポーネント）、Playwright + axe-core（a11y）。config.toml / DNS / プロバイダ設定はユニットテスト対象外 → quickstart.md の手動検証で担保

**Target Platform**: Web（service-front / admin-front）+ 本番 Supabase プロジェクト

**Project Type**: Web アプリケーション（フロント 2 つ: `service-front` / `admin-front` + Supabase バックエンド）

**Performance Goals**: 認証メール到達 送信から 2 分以内 99%（SC-001）／ SMS コード到達 1 段階目成功後 30 秒以内（SC-004）

**Constraints**:
- 2 要素認証はオプトイン（本人が設定画面で有効化）、有効化済みは毎回のログインで SMS 必須（信頼済みデバイスはスコープ外）
- メール送信元 = SMTP（Resend、プロジェクト既存の email プロバイダに統一 / tasks.md T004）／ SMS = Twilio（既存 config.toml の雛形に準拠）
- 2FA 未有効化ユーザーのログイン体験は不変（FR-015）
- Twilio SMS / MFA は Supabase Pro プラン前提（config.toml 記載）

**Scale/Scope**: 初期のユーザー規模は小。2 要素認証は有効化した一部ユーザーのみが対象

## Constitution Check

*GATE: Phase 0 前に通過必須。Phase 1 設計後に再評価。*

| 原則 | 判定 | 対応方針 |
|------|------|----------|
| I. Spec-Driven Development | PASS | spec → clarify → plan の順で進行。実装は tasks 後 |
| II. Server Components First | PASS（要注意） | 設定画面ページ・ログインページは Server Component。MFA の enroll/challenge/verify とコード入力、再送ボタンは操作が必須なため最小の Client Component に限定 |
| III. Test-First（テスト同梱） | PASS（要注意） | サーバーアクション（再送・MFA enroll/verify・admin 解除）とスキーマは Vitest 先行。新規 UI コンポーネントは Vitest + a11y（service-front は Storybook も）同梱。config/DNS/テンプレートは quickstart の手動検証で代替（ユニット不能な旨を明記） |
| IV. Security & RLS by Default | PASS | `public` に新規テーブルを作らない方針のため RLS 追加は原則不要。admin の要素解除は **サービスロールキー**（server-only・`requireAdmin()` ガード内のみ）で Supabase Admin API を呼び、`recordAudit` で監査記録。サービスロールキーはクライアントへ絶対に露出しない |
| V. Accessibility（WCAG 2.1 AA） | PASS | フォームは label 関連付け・`aria-invalid`・エラー `role="alert"`。OTP 入力は適切なラベルと `inputmode`。既存 auth フォームのパターンに準拠 |
| VI. Coding Standards（rules/ 準拠） | PASS | Feature-based 配置、TypeScript strict、Tailwind、命名規約に準拠 |

**GATE 結果**: 違反なし。Complexity Tracking への記載は不要。

## Project Structure

### Documentation (this feature)

```text
specs/023-signup-email-phone-auth/
├── plan.md              # This file
├── research.md          # Phase 0 output（プロバイダ・DNS・AAL 強制・レート制限の決定）
├── data-model.md        # Phase 1 output（auth スキーマ外部エンティティ + テンプレート）
├── quickstart.md        # Phase 1 output（本番メール到達 / MFA / admin 解除の手動検証）
├── contracts/           # Phase 1 output（サーバーアクション契約）
│   ├── service-front-mfa.md
│   ├── service-front-email.md
│   └── admin-front-mfa.md
├── checklists/
│   └── requirements.md  # 既存（specify/clarify で作成済み）
└── tasks.md             # /speckit-tasks で作成（本コマンドでは作らない）
```

### Source Code (repository root)

本フィーチャーは既存の 2 フロント + Supabase 構成に追記する。主に触れる実ディレクトリ:

```text
supabase/
├── config.toml                     # [auth.email.smtp] 有効化 / [auth.mfa.phone] / [auth.sms.twilio] 有効化
└── templates/                      # 日本語メールテンプレート（confirmation / recovery 等）を新規追加

service-front/src/
├── features/auth/
│   ├── server/actions.ts           # resendConfirmationEmail 追加
│   └── components/client/           # 確認メール再送ボタン / ログイン 2 段階目コード入力フォーム
├── features/mfa/                    # MFA enroll/verify/disable のサーバーアクション + フォーム（research.md Decision 9 で新規機能に確定）
│   ├── server/actions.ts
│   ├── schemas/
│   ├── lib/aalGuard/                # AAL 判定ユーティリティ（isMfaChallengePending）
│   └── components/client/TwoFactorSettings/ 等
├── app/(authenticated)/settings/two-factor/   # 2 要素認証 設定ページ（新規）
├── app/(auth)/login/verify/         # 2 段階目チャレンジページ（verify ページ方式に確定）
└── app/(authenticated)/layout.tsx   # AAL2 未達（enroll 済みで aal1）の保護ルート遮断（layout に一元化。proxy.ts は注記コメントのみ / research.md Decision 6）

admin-front/src/
├── shared/lib/supabase/admin.ts     # サービスロールクライアント（server-only・新規）
├── features/users-admin/
│   ├── server/actions.ts            # removeMfaFactor(userId) 追加（Admin API + recordAudit）
│   └── server/queries.ts            # ユーザーの MFA 有効状態取得（任意）
└── app/(admin)/users/[id]/          # ユーザー詳細に「2 要素認証を解除」ボタン
```

**Structure Decision**: 既存の Feature-based 構成を踏襲。service-front の MFA 関連は「`account` 機能に追加」か「新規 `mfa` 機能に切り出す」かを Phase 0 で確定（research.md）。admin 側は既存 `users-admin` 機能に解除アクションを追加する。`public` スキーマの新規テーブルは追加しない（MFA 状態は auth スキーマが保持）。

## Complexity Tracking

> Constitution Check に違反がないため記載不要。
