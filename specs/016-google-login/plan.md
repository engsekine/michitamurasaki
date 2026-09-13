# Implementation Plan: 認証（Google ログイン / ソーシャルログイン）

**Branch**: `016-google-login` | **Date**: 2026-06-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/016-google-login/spec.md`

## Summary

`001-auth`（メール + パスワード）を拡張し、Supabase Auth の OAuth プロバイダ機能で **Google ログイン**を追加する。`/login` `/signup` に「Google でログイン / 続行」導線を置き、Server Action `signInWithGoogle()` から `signInWithOAuth({ provider: 'google' })` を呼び、既存の `/api/auth/callback`（`exchangeCodeForSession`）で戻りを処理する。初回 OAuth サインアップでは Google が氏名・メールしか返さないため、`handle_new_user` トリガーを分岐させ `user_details` 行を作らず（＝プロフィール未補完）、`/profile-completion` でニックネーム・生年月日・性別・姓名を **必須入力**させてから TOP（`/`）に到達させる（確定論点 ①）。同一メールの既存メール+パスワードアカウントへは Supabase の自動アイデンティティ紐付けに委譲し、重複アカウントを作らない（確定論点 ②）。

## Technical Context

**Language/Version**: TypeScript（strict mode）/ Next.js App Router / React（React Compiler 有効）

**Primary Dependencies**: Supabase Auth（`@/shared/lib/supabase` の `createClient`: server / browser / middleware）、yup（フォームバリデーション）、React Hook Form、Tailwind CSS

**Storage**: Supabase（PostgreSQL）。`auth.users` + `public.users` + `public.user_details`（[data-model.md](data-model.md) 参照。本機能では `user_details` に INSERT ポリシー追加と `handle_new_user` 分岐の 1 マイグレーション）

**Testing**: Vitest（スキーマ・Server Actions 単体テスト）、Storybook、Playwright（E2E + axe-core a11y）

**Target Platform**: Web（service-front: Next.js アプリケーション）。管理画面（admin-front）は対象外

**Project Type**: Web application（モノレポ内の `service-front/` + `supabase/` マイグレーション）

**Performance Goals**: 特別な性能要件なし（認証は Supabase Auth に委譲）。プロフィール補完判定は `(authenticated)` レイアウトでの 1 回の `user_details` 行存在 SELECT に限定し、middleware に DB 往復を増やさない

**Constraints**: セッションは httpOnly cookie。OAuth は PKCE（`code` → `exchangeCodeForSession`）。Google プロバイダの client_id / secret は `.env`（コミット禁止）で注入し `config.toml` は `env(...)` 参照。ローカルは `skip_nonce_check = true`。`user_details` の NOT NULL / CHECK 制約は弱めない

**Scale/Scope**: 新規画面 1（`/profile-completion`）+ 既存 `/login` `/signup` への Google ボタン追加 + Server Action 2 つ（`signInWithGoogle` / `completeProfile`）+ DB マイグレーション 1 + `config.toml` の Google プロバイダ設定。対象外: Google 以外のプロバイダ、MFA、連携解除、admin-front への適用

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` v1.0.0 準拠で評価。

| 原則 | 準拠状況 |
|------|---------|
| I. Spec-Driven Development | spec.md → plan.md → （tasks.md）の順で進行。違反なし |
| II. Server Components First | OAuth 開始・補完保存は Server Actions、補完ゲートは `(authenticated)` Server Component レイアウト。Google ボタン押下のみ最小 Client。違反なし |
| III. Test-First | 追加スキーマ（`completeProfile` の yup）・Server Actions は Vitest、`ProfileCompletionForm` / `GoogleAuthButton` は Vitest + Storybook + Playwright a11y を同梱。違反なし |
| IV. Security & RLS by Default | `user_details` の INSERT ポリシーは `with check ((select auth.uid()) = user_id)`、`handle_new_user` は `security definer set search_path = ''` を維持。シークレットは env。違反なし |
| V. Accessibility（WCAG 2.1 AA） | 補完フォームは label 関連付け・`role="alert"`・`aria-invalid`、Google ボタンはアクセシブル名を持つ。違反なし |
| VI. Coding Standards | TypeScript strict / `any` 禁止、Feature-based（`features/auth`）、Tailwind utility-first、snake_case / RLS / timestamptz。違反なし |

**判定**: 違反なし。Complexity Tracking 記載なし。

## Project Structure

### Documentation (this feature)

```text
specs/016-google-login/
├── spec.md              # 機能仕様
├── plan.md              # This file
├── research.md          # Phase 0: 設計判断（トリガー分岐・自動紐付け 等）
├── data-model.md        # Phase 1: user_details 変更（INSERT ポリシー / トリガー分岐）
├── quickstart.md        # Phase 1: 検証手順（ローカル Google ログイン E2E）
├── contracts/           # Phase 1: Server Actions / 補完フォームの契約
│   ├── server-actions.md
│   └── profile-completion-schema.md
└── tasks.md             # Phase 2 出力（/speckit-tasks。本コマンドでは作らない）
```

### Source Code (repository root)

```text
service-front/src/app/
├── (auth)/
│   ├── login/page.tsx                 # 既存。GoogleAuthButton を追加表示
│   └── signup/page.tsx                # 既存。GoogleAuthButton を追加表示
├── (authenticated)/
│   ├── layout.tsx                     # ★変更: user_details 未作成なら /profile-completion へ redirect
│   ├── profile-completion/
│   │   └── page.tsx                   # ★新規: 補完フォーム画面（補完済みは TOP（/）へ戻す）
│   └── dives/...                      # 既存
└── api/auth/
    └── callback/route.ts              # ★軽微変更: OAuth code を exchangeCodeForSession で処理（既存）+ error クエリ転送（キャンセル時 /login?error=oauth_cancelled）

service-front/src/features/auth/
├── components/client/
│   ├── GoogleAuthButton/              # ★新規: 「Google でログイン」ボタン（+ test/stories/index）
│   ├── ProfileCompletionForm/         # ★新規: 補完フォーム（+ test/stories/index）
│   ├── LoginForm/                     # 既存（GoogleAuthButton を配置）
│   └── SignupForm/                    # 既存（GoogleAuthButton を配置）
├── schemas/
│   ├── profile-completion.schema.ts   # ★新規: 補完入力の yup（signup.schema から共通項目を再利用）
│   └── signup.schema.ts               # 既存
├── server/
│   └── actions.ts                     # ★変更: signInWithGoogle() / completeProfile() を追加
└── index.ts

service-front/src/proxy.ts             # 既存（認証ガード。/profile-completion は認証必須ルートとして許容）

supabase/
├── config.toml                        # ★変更: [auth.external.google] を追加
└── migrations/
    └── <ts>_alter_handle_new_user_for_oauth.sql  # ★新規: トリガー分岐 + user_details INSERT ポリシー
```

**Structure Decision**: `001-auth` と同じ Feature-based 構成を踏襲し、Google ログイン関連は `service-front/src/features/auth/` に集約する。新規画面 `/profile-completion` は `(authenticated)` グループ配下（認証必須）に置き、補完ゲートはグループ `layout.tsx`（Server Component）で行う。DB 変更は `supabase/migrations/` に 1 ファイル追加（トリガー再定義 + INSERT ポリシー）。Google プロバイダ設定は `config.toml` + `.env`。

## 設計の詳細

### Server Actions の責務（追加分）

| Action | 役割 |
|--------|------|
| `signInWithGoogle()` | `signInWithOAuth({ provider: 'google', options: { redirectTo: '{site_url}/api/auth/callback?next=/' } })` を呼び、`data.url` へリダイレクト。失敗時は `ActionResult` で差し戻し |
| `completeProfile(input)` | yup 検証後、`public.user_details` に本人行を INSERT（RLS の `with check` で本人限定）。成功で TOP（`/`）へ |

既存の `signIn` / `signUp` / `signOut` / `requestPasswordReset` は変更しない。契約詳細は [contracts/server-actions.md](contracts/server-actions.md)。

### OAuth ログインフロー

1. ユーザーが `/login`（または `/signup`）の「Google でログイン」を押す
2. `signInWithGoogle()` が `signInWithOAuth` を呼び、返却 URL（Google 同意画面）へリダイレクト
3. ユーザーが Google で認証・同意 → Supabase 経由で `{site_url}/api/auth/callback?code=...&next=/` に戻る
4. 既存 callback route が `exchangeCodeForSession(code)` でセッション cookie を発行
5. TOP（`/`）へリダイレクト → `(authenticated)/layout.tsx` が `user_details` 行の有無を確認
   - 行あり（既存ユーザー / 補完済み / 自動紐付け先）→ TOP（`/`）表示
   - 行なし（OAuth 初回）→ `/profile-completion` へ redirect
6. 補完フォーム送信 → `completeProfile()` が `user_details` を INSERT → TOP（`/`）

#### キャンセル / 失敗 / 未確認メールの扱い（FR-006 / FR-009 / FR-010）

- **コールバック失敗**（`code` 交換エラー）→ 既存どおり `/login?error=auth_callback_failed`
- **キャンセル**（ユーザーが Google 同意を拒否）→ Google/Supabase は `code` 無し + `error` クエリ付きで戻すため、callback を「`code` 無し + `error` あり → `/login?error=oauth_cancelled`」に拡張する。`LoginForm` が `error` クエリを読み、`role="alert"` で文言（キャンセル / 失敗）を表示する
- **メール未確認**（FR-006）→ 補完ゲートと同じ `(authenticated)/layout.tsx`（または callback）でセッションユーザーの `email_confirmed_at` を判定し、未確認なら `signOut()` のうえ `/login?error=email_not_verified` へ。Google が返すメールは通常 `email_verified=true` で Supabase に確認済みとして取り込まれるため実際にはレアケースだが、防御的に拒否する（[spec Assumptions](spec.md) 参照）

### handle_new_user トリガー分岐（[data-model.md](data-model.md) 参照）

`auth.users` INSERT 時、`public.users` は常に挿入。`public.user_details` は `raw_user_meta_data ? 'nickname'` が真（= メールサインアップ経路）のときのみ挿入する。OAuth 初回は `user_details` を作らず「未補完」を表す。`security definer set search_path = ''` は維持。

### 補完ゲート（`(authenticated)/layout.tsx`）

ログインユーザーの `user_details` 行存在を 1 回 SELECT し、無ければ `/profile-completion` へ `redirect()`。`/profile-completion` 自身は未補完を許容し、補完済みアクセス時は TOP（`/`）へ戻す。middleware（`proxy.ts`）には DB 往復を追加しない。

### config.toml（Google プロバイダ）

```toml
[auth.external.google]
enabled = true
client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"
# ローカルで Google サインインするために必須
skip_nonce_check = true
```

`additional_redirect_urls` には `https://localhost:3000/api/auth/callback` が登録済みのため追加不要。

### アクセシビリティ

- 「Google でログイン」ボタンはアクセシブルな名前（テキスト）を持ち、アイコンは `aria-hidden`
- 補完フォームは label を `htmlFor` / `id` で関連付け、エラーは `role="alert"` + `aria-describedby`、必須は `aria-required`、送信は `aria-busy`

### セキュリティ

- OAuth は PKCE（`code` 交換）。セッションは httpOnly cookie
- Google client_id / secret は `.env`（コミット禁止）で注入
- `user_details` INSERT は RLS `with check ((select auth.uid()) = user_id)` で本人のみ。PK = `user_id` で重複不可
- 自動紐付けは Supabase 既定（確認済みメール一致時）に委譲。未確認メールはログイン拒否

## Complexity Tracking

Constitution Check に違反なしのため、記載事項なし。
