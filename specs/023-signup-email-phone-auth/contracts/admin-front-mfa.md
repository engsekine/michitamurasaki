# Contract: 管理者による 2 要素認証の解除（admin-front / FR-016）

認証アプリを入れた端末の紛失・機種変更時のリカバリー。既存 `admin-front/src/features/users-admin/` に追加する。Supabase Admin API（service_role 必須）を使うため、サービスロールクライアントを新設する。

## サービスロールクライアント（新規）

- **Path**: `admin-front/src/shared/lib/supabase/admin.ts`（`server-only`）
- **中身**: `createClient<Database>(url, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })`。
- **制約**: クライアントバンドルへ絶対に含めない。`requireAdmin()` を通過したサーバーアクション内でのみ import・使用する。

## removeMfaFactor

```
removeMfaFactor(userId: string): Promise<ActionResult>
```

- **ガード**: 先頭で `requireAdmin()`（未認証/非管理者はリダイレクト）。
- **処理**:
  1. `adminClient.auth.admin.mfa.listFactors({ userId })` で対象ユーザーの要素一覧を取得。
  2. 取得した要素すべてを `adminClient.auth.admin.mfa.deleteFactor({ id, userId })` で削除。
  3. `recordAudit(supabase, adminId, { action: 'hard_delete', targetTable: 'mfa_factors', targetId: userId, changes: { removedFactorIds } })` で監査記録（audit action は新規値を追加せず既存の `hard_delete` を再利用 / T028）。
- **監査の堅牢性**: 途中の削除失敗で一部だけ削除された場合も、削除できた要素 ID は必ず監査ログに記録する（証跡欠落を防ぐ）。監査記録自体の失敗は捕捉してログ出力し、解除操作は巻き戻さない。
- **結果**: 成功で `{ success: true }`（`ActionResult`）。以後、対象ユーザーは 2 段階目なしでログインでき、必要なら再登録できる（FR-016）。
- **失敗**: 対象なし/削除失敗は `{ success: false, error }`。

## getUserMfaStatus

```
getUserMfaStatus(userId: string): Promise<{ enabled: boolean }>
```

- ユーザー詳細で「2 要素認証: 有効/無効」を表示し、解除ボタンの出し分けに使う。先頭で `requireAdmin()`。
- `listFactors` の結果に `status === 'verified'` の要素があれば `enabled: true`。取得失敗時は `enabled: false`（安全側）。

## 管理者自身のログイン 2 段階目（`features/admin-auth/server/mfaActions.ts`）

```
getLoginMfaFactorId(): Promise<string | null>            // verified な totp 要素 ID
verifyAdminLogin(factorId: string, code: string): Promise<ActionResult>  // challengeAndVerify → 成功で redirect('/')
```

- 管理者も同じ `auth.users` の TOTP 要素を使う（登録は service-front の設定画面から行う）。2026-10-09 に SMS から TOTP へ移行し、再送 API（`challengeAdminLoginFactor`）は廃止。

## UI

- `admin-front/src/app/(admin)/users/[id]/`（ユーザー詳細）に「2 要素認証を解除」ボタン。
- 破壊的操作のため確認ダイアログ + 実行結果の通知（`role="status"`/`role="alert"`）。
- 有効な要素が無いユーザーではボタンを非活性/非表示。

## セキュリティ

- service_role キーはサーバー専用。監査必須。Constitution IV に準拠。
