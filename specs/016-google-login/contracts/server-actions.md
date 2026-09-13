# Contract: Server Actions（Google ログイン / プロフィール補完）

**Feature**: [../spec.md](../spec.md) | **Plan**: [../plan.md](../plan.md)

`service-front/src/features/auth/server/actions.ts` に追加する 2 つの Server Action の入出力契約。戻り値は既存の `ActionResult` 型（`@/shared/types/action-result`）に揃える。リダイレクトを伴うものは Next.js の `redirect()` を用いる。

---

## `signInWithGoogle(): Promise<ActionResult>`

Google OAuth 認証フローを開始する。

| 項目 | 内容 |
|------|------|
| 入力 | なし |
| 副作用 | `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })` を呼び、`data.url`（Google 同意画面）へ `redirect()` |
| `redirectTo` | `{NEXT_PUBLIC_SITE_URL}/api/auth/callback?next=/` |
| 成功時 | Google 同意画面へリダイレクト（関数は戻らない） |
| 失敗時 | `actionFailure('Google ログインを開始できませんでした。時間をおいて再度お試しください')` |

**契約条件**:
- 成功時の `data.url` が空の場合は失敗として差し戻す。
- `next` は `/` 固定（オープンリダイレクト防止のため外部入力を受けない）。

**受け入れ対応**: FR-001 / FR-002 / FR-003。

---

## `completeProfile(input: CompleteProfileInput): Promise<ActionResult>`

OAuth 初回ログインユーザーのプロフィールを補完し、`public.user_details` に本人行を INSERT する。

### 入力 `CompleteProfileInput`

`001-auth` の `SignUpInput` からメール / パスワードを除いた形。

| フィールド | 型 | 必須 | 備考 |
|------------|----|------|------|
| `lastName` | `string` | ✓ | 漢字・50 文字以内・空白のみ不可 |
| `firstName` | `string` | ✓ | 同上 |
| `lastNameRomaji` | `string` | ✓ | 半角英字のみ・50 文字以内 |
| `firstNameRomaji` | `string` | ✓ | 同上 |
| `nickname` | `string` | ✓ | 50 文字以内・空白のみ不可 |
| `birthOn` | `string`（YYYY-MM-DD） | ✓ | 1900-01-01〜当日 |
| `gender` | `Gender`（`male`/`female`/`unanswered`） | ✓ | 既定 `unanswered` |
| `heightCm` | `number \| null` | — | 任意 |
| `weightKg` | `number \| null` | — | 任意 |

### 挙動

| 状況 | 結果 |
|------|------|
| 未認証で呼ばれた | `actionFailure`（認証必須）。実質は `(authenticated)` レイアウト + proxy で到達不可 |
| 入力が yup 検証に失敗 | `actionFailure`（フィールド単位のメッセージはクライアント側 RHF で表示。Action はサーバ再検証で防御） |
| `user_details` 行が既に存在（補完済み再送） | 一意制約違反 → `actionFailure` せず TOP（`/`）へ `redirect()`（冪等に扱う） |
| 正常 | `public.user_details` に INSERT（`user_id = (select auth.uid())`）→ TOP（`/`）へ `redirect()` |

**契約条件**:
- INSERT は RLS `users can insert own details`（`with check ((select auth.uid()) = user_id)`）に依存。`user_id` はクライアント入力ではなくサーバの `auth.uid()` を使う。
- サーバ側でも yup スキーマ（[profile-completion-schema.md](profile-completion-schema.md)）で再検証する（クライアント検証を信頼しない）。

**受け入れ対応**: FR-004 / FR-005、US2-2 / US2-3。

---

## 既存 Action（変更なし・参照のみ）

| Action | 状態 |
|--------|------|
| `signIn` / `signUp` / `signOut` / `requestPasswordReset` | 変更なし。`signUp` の `options.data.nickname` が `handle_new_user` の分岐キーとして機能する点のみ留意 |

## コールバック（軽微変更）

`GET /api/auth/callback`（`service-front/src/app/api/auth/callback/route.ts`）は OAuth の `code` を `exchangeCodeForSession` で処理する（既存）。本機能で **error クエリ転送**を追加する:

| 受信 | リダイレクト先 |
|------|----------------|
| `code` あり・交換成功 | `next`（既定 `/`） |
| `code` あり・交換失敗 | `/login?error=auth_callback_failed`（既存） |
| `code` 無し・`error` あり（キャンセル等） | `/login?error=oauth_cancelled`（★追加） |
| `code` 無し・`error` 無し | `/login`（既存） |

`LoginForm` は `error` クエリを読み `role="alert"` で文言を表示する。FR-009 / FR-010 を担保。メール未確認の拒否（FR-006）は `(authenticated)/layout.tsx`（または callback）で `email_confirmed_at` を判定し `/login?error=email_not_verified` へ誘導する。
