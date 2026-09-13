# Contract: 確認メール再送（service-front / US1）

サーバーアクション。既存 `service-front/src/features/auth/server/actions.ts` に追加する。既存 `signUp` は変更不要（確認メールは既に送信される。本番配信は config/DNS で実現）。

## resendConfirmationEmail

```
resendConfirmationEmail(email: string): Promise<ActionResult>
```

- **目的**: 未確認ユーザーがサインアップ確認メールを再送する（FR-004）。
- **入力**: `email`（サインアップに使ったアドレス）。
- **処理**: `supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: `${siteUrl}/api/auth/callback?next=/` } })`。`siteUrl` は `NEXT_PUBLIC_SITE_URL`（未設定時 `https://localhost:3000`）。
- **成功**: `{ success: true }`（`ActionResult`）。UI は「確認メールを再送しました。メールをご確認ください。」+ 60 秒クールダウン開始。
- **レート制限**: `{ success: false, error: '確認メールの再送は、しばらく時間をおいてから再度お試しください' }`（status 429 または rate limit エラー時 / FR-005）。
- **既確認/存在しないアドレス/その他の失敗**: ユーザー列挙を避けるため、レート制限以外の失敗はすべて成功と同一の見え方にする（`{ success: true }` を返し、UI 文言も成功時と同一）。

### 呼び出し UI

- サインアップ直後の「確認メールを送信しました」画面（`SignupForm` の完了状態）に再送ボタン。
- `/login?error=email_not_verified` 表示時の再送導線。
- ボタンはクールダウン中 `disabled`、`aria-live` で結果を通知。

### 受け入れ対応

- Acceptance US1-4（再送）、US1-1〜3（本番到達は config/DNS + quickstart 検証で担保）。
