# Implementation Plan: 認証（メール + パスワード）

**Branch**: `001-auth` | **Date**: 2026-06-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-auth/spec.md`

**Note**: 既存仕様書からの移行ドキュメント。

## Summary

メール + パスワードによる認証（サインアップ / ログイン / ログアウト / パスワードリセット / 認証ガード）を Supabase Auth で実現する。Next.js App Router 上で Server Actions（signIn / signUp / signOut / requestPasswordReset）を実装し、ミドルウェアで認証必須ルートを保護する。サインアップはメール確認フロー（確認メール → `/api/auth/callback` でセッション発行 → TOP（`/`））を採用し、プロフィール属性は `auth.users` の insert トリガー経由で `public.users` / `public.user_details` に保存する。

## Technical Context

**Language/Version**: TypeScript（strict mode）/ Next.js App Router / React（React Compiler 有効）

**Primary Dependencies**: Supabase Auth（`@repo/supabase` の `createClient`: browser / server / middleware）、yup（フォームバリデーション）、Tailwind CSS

**Storage**: Supabase（PostgreSQL）。`auth.users` + `public.users` + `public.user_details`（[data-model.md](data-model.md) 参照）

**Testing**: Vitest（スキーマ・Server Actions 単体テスト）、Storybook、Playwright（E2E）

**Target Platform**: Web（service-front: Next.js アプリケーション）

**Project Type**: Web application（モノレポ内の `service-front/` + `supabase/` マイグレーション）

**Performance Goals**: 特別な性能要件なし（認証処理は Supabase Auth に委譲。レート制限は Supabase 側の `auth.rate_limit` に従う）

**Constraints**: セッションは httpOnly cookie。CSRF は Next.js Server Actions の保護に従う。サインアップはメール確認完了までセッションを発行しない（`enable_confirmations = true` 前提）

**Scale/Scope**: 画面 3 つ（`/login` `/signup` `/reset-password`）+ コールバック API + 認証ガード。Phase 1 ではソーシャルログイン / MFA / メール変更 / アカウント削除 / 招待は対象外

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` 準拠（移行時点では `.claude/rules/` のコーディング規約 — typescript / react / html / css / sql / accessibility / readable-code — を原則として適用）。

違反なし。

## Project Structure

### Documentation (this feature)

```text
specs/001-auth/
├── spec.md              # 機能仕様（requirements.md からの移行）
├── plan.md              # This file（design.md からの移行）
├── data-model.md        # users / user_details テーブル定義（tables/*.md からの移行）
└── tasks.md             # タスク一覧（tasks.md からの移行）
```

### Source Code (repository root)

```text
service-front/src/app/
├── (auth)/                       # 認証グループ（未認証で閲覧可、認証済みは弾く）
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   └── reset-password/page.tsx
├── (authenticated)/              # 認証必須グループ（design.md では (app) と表記）
│   └── dives/...
└── api/auth/
    └── callback/route.ts         # メール認証 / OAuth コールバック

service-front/src/features/auth/
├── components/
│   └── client/
│       ├── LoginForm/            # LoginForm.tsx + test + stories + index.ts
│       ├── SignupForm/
│       ├── ResetPasswordForm/
│       └── AuthNav/              # ヘッダーのログアウトボタン
├── schemas/
│   ├── login.schema.ts
│   ├── signup.schema.ts
│   └── reset.schema.ts
├── server/
│   └── actions.ts                # Server Actions（signIn / signUp / signOut / requestPasswordReset）
└── index.ts

service-front/src/proxy.ts        # 認証ガード（design.md では src/middleware.ts と表記）

supabase/
├── config.toml                   # enable_confirmations = true / [inbucket]
└── migrations/
    ├── 20260509100821_create_users.sql
    └── 20260514120000_create_user_details.sql
```

**Structure Decision**: Feature-based アーキテクチャ（`arch/feature-based.md`）に従い、認証ロジックは `service-front/src/features/auth/` に集約する。ルーティングは App Router のルートグループで「未認証向け `(auth)`」と「認証必須 `(authenticated)`」を分離し、ガードはミドルウェア（実装上は `src/proxy.ts`）で行う。DB スキーマは `supabase/migrations/` で管理する。

## 認証設計の詳細

### 技術選定

- **認証基盤**: Supabase Auth
- **クライアント**: `@repo/supabase` の `createClient`（browser / server / middleware）

### ミドルウェア（認証ガード）

認証必須グループ配下を保護する。

```ts
// 擬似コード
export async function middleware(request: NextRequest) {
  const { user } = await getUser(request)

  const isAppRoute = request.nextUrl.pathname.startsWith('/dives')
  const isAuthRoute = ['/login', '/signup'].includes(request.nextUrl.pathname)

  if (isAppRoute && !user) return NextResponse.redirect(new URL('/login', request.url))
  if (isAuthRoute && user) return NextResponse.redirect(new URL('/', request.url))
  return NextResponse.next()
}
```

### yup スキーマ例

```ts
// signup.schema.ts
export const signupSchema = yup.object({
  email: yup.string().email().required(),
  password: yup.string().min(6).required(),
  passwordConfirm: yup
    .string()
    .oneOf([yup.ref('password')], 'パスワードが一致しません')
    .required(),
})
```

### Server Actions の責務

| Action | 役割 |
|--------|------|
| `signIn(email, password)` | Supabase でログイン → セッション cookie 設定 |
| `signUp(email, password)` | Supabase でユーザー作成 → 確認メール送信（`emailRedirectTo` で `/api/auth/callback?next=/` を指定） |
| `signOut()` | セッション破棄 |
| `requestPasswordReset(email)` | リセットメール送信 |

### サインアップのメール確認フロー

1. ユーザーが `/signup` でフォーム送信
2. `signUp` Server Action が `supabase.auth.signUp({ email, password, options: { emailRedirectTo } })` を呼ぶ
3. Supabase が確認メールを送信し、レスポンスは `session = null` で返る
4. SignupForm はレスポンスの `needsEmailConfirmation` を見て「確認メールを送信しました」表示に切り替え
5. ユーザーがメール内リンク（`{site_url}/api/auth/callback?code=...&next=/`）をクリック
6. callback route が `exchangeCodeForSession(code)` でセッション cookie を発行
7. TOP（`/`）にリダイレクト

ローカル開発時は Inbucket（`http://127.0.0.1:54324`）でメールを確認できる（`supabase/config.toml` の `[inbucket]` 参照）。

Supabase の `enable_confirmations = true` が前提（`supabase/config.toml` 参照）。

### データ保存（RLS 方針）

- `public.users` / `public.user_details` は RLS 有効。SELECT / UPDATE のみ本人（`(select auth.uid()) = id` / `= user_id`）に許可
- INSERT は `handle_new_user()` トリガー（`SECURITY DEFINER`）が RLS をバイパスして行う。アプリケーションから直接 insert しない
- 詳細は [data-model.md](data-model.md) を参照

### アクセシビリティ

- ラベルと input を `htmlFor` / `id` で関連付ける
- エラーメッセージは `aria-describedby` で input に結ぶ
- 必須フィールドは `aria-required="true"`
- 送信ボタンには `aria-busy` でローディング状態を伝える

### セキュリティ

- パスワードは Supabase Auth が bcrypt でハッシュ化
- セッションは httpOnly cookie
- CSRF: Next.js Server Actions の保護に従う
- レート制限: Supabase 側の `auth.rate_limit` に従う

## Complexity Tracking

Constitution Check に違反なしのため、記載事項なし。
