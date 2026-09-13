# Quickstart: 認証（Google ログイン / ソーシャルログイン）

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Google ログインがエンドツーエンドで動くことをローカルで検証する手順。実装コードは含めない（タスクは `/speckit-tasks` で生成）。

## 前提（実装フェーズの準備作業）

1. **Google OAuth クライアントの発行**: Google Cloud Console で OAuth 2.0 クライアント ID を作成。承認済みリダイレクト URI に Supabase ローカルの auth コールバック（`http://127.0.0.1:54321/auth/v1/callback`）を登録する。
2. **環境変数**: `.env`（コミット禁止）に以下を設定する。
   - `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`
   - `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`
3. **`supabase/config.toml`**: `[auth.external.google]` を `enabled = true` / `client_id = "env(...)"` / `secret = "env(...)"` / `skip_nonce_check = true`（ローカル）で追加（[plan.md](plan.md) 参照）。
4. **マイグレーション適用**: `handle_new_user` 分岐 + `user_details` INSERT ポリシーのマイグレーションを反映する。

```bash
# リポジトリルートで
supabase stop && supabase start   # config.toml と env を読み直す
supabase migration up             # 追加マイグレーションを適用
```

## 検証シナリオ

### シナリオ A: Google で新規アカウント作成 → プロフィール補完（US2 / P1）

1. service-front を起動（`https://localhost:3000`）。
2. アプリ未登録の Google アカウントでブラウザにログインしておく。
3. `/login` を開き「Google でログイン」を押す。
4. Google 同意画面で同意する。
5. **期待**: `/api/auth/callback` 経由でセッションが発行され、`user_details` が無いため `/profile-completion` にリダイレクトされる。
6. 補完フォームで姓名（漢字 / ローマ字）・ニックネーム・生年月日・性別を入力して送信する。
7. **期待**: TOP（`/`）に到達し、ダイブログを記録できる。
8. 補完フォームで必須項目を空にして送信する → **期待**: エラー表示され TOP（`/`）に進めない（US2-3）。

### シナリオ B: 既存 Google ユーザーの再ログイン（US1 / P1）

1. シナリオ A を完了したアカウントでログアウトする。
2. `/login` →「Google でログイン」→ 同意。
3. **期待**: `user_details` 行が既にあるため補完を挟まず直接 TOP（`/`）に到達する（パスワード入力なし、SC-001）。

### シナリオ C: 同一メールの自動紐付け（US3 / P2）

1. 既存のメール + パスワードユーザー（メール確認済み）と **同じメールアドレス**の Google アカウントを用意する。
2. ログアウト状態で `/login` →「Google でログイン」→ 同意。
3. **期待**: 新規アカウントが作られず既存ユーザーとしてログインし、既存のダイブログ履歴がそのまま見える（SC-004）。`user_details` は既存のものが維持され補完は不要。

### シナリオ D: キャンセル / コールバック失敗（FR-009 / FR-010）

1. `/login` →「Google でログイン」→ Google 同意画面で **キャンセル**する。
2. **期待**: `/login` に戻り、ログイン未完了のメッセージが表示される。
3. （任意）不正な `code` で `/api/auth/callback` を叩く → **期待**: `/login?error=auth_callback_failed`。

### シナリオ E: 認証ガード（US4 / SC-005）

1. 未認証ブラウザで `/dives` にアクセス → **期待**: `/login` にリダイレクト。
2. Google ログイン済みで `/login` `/signup` にアクセス → **期待**: TOP（`/`）にリダイレクト。
3. Google ログイン済みでログアウト → **期待**: セッション破棄 → `/login`。

## 自動テスト（受け入れ対応）

| テスト | 対象 | 受け入れ |
|--------|------|----------|
| Vitest | `profile-completion.schema` の各バリデーション | FR-005 |
| Vitest | `signInWithGoogle` / `completeProfile` の戻り値・リダイレクト | FR-002/003/004 |
| Storybook + Playwright a11y | `GoogleAuthButton` / `ProfileCompletionForm` | 憲章 V |
| Playwright E2E | 上記シナリオ A〜E | SC-001〜SC-005 |

## 完了の目安

- シナリオ A〜E がすべて手動 / E2E で再現・合格する。
- 既存のメール + パスワードのサインアップ / ログイン（`001-auth`）が回帰していない。
