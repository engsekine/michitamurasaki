# Contract: SMS 2 要素認証（service-front / US2）

新規 `service-front/src/features/mfa/`。MFA の enroll/challenge/verify/disable と、ログイン 2 段階目のチャレンジを担う。操作系はすべて **サーバーアクション**（`features/mfa/server/actions.ts` / `'use server'`）に集約し、Client Component（`MfaChallengeForm` / `TwoFactorSettings`）はそれを呼び出す構成とした。

## 有効化（設定画面）

### enrollPhoneFactor

```
enrollPhoneFactor(phone: string): Promise<ActionResult<{ factorId: string, challengeId: string }>>
```

- **目的**: 電話番号を登録し確認コードを送信（FR-008/009）。
- **処理**: `mfa.enroll({ factorType: 'phone', phone })` → 返った `factorId` で `mfa.challenge({ factorId })`（SMS 送信）。
- **検証**: `phone` は E.164 形式・必須。クライアント側（`TwoFactorSettings`）で `E164_PATTERN` により事前検証し、サーバー側は Supabase のエラーで拒否（Edge Case）。
- **失敗**: enroll 失敗は「電話番号の登録を開始できませんでした。番号（国際形式）をご確認ください」、challenge 失敗は「確認コードの送信に失敗しました。時間をおいて再度お試しください」。

### verifyPhoneFactor

```
verifyPhoneFactor(factorId: string, challengeId: string, code: string): Promise<ActionResult>
```

- **処理**: `mfa.verify({ factorId, challengeId, code })`。成功で要素が `verified`＝2FA 有効化（FR-009）。
- **失敗**: 誤コード/期限切れは拒否して再入力（FR-011 相当）。

### disablePhoneFactor

```
disablePhoneFactor(factorId: string): Promise<ActionResult>
```

- **処理**: `mfa.unenroll({ factorId })`（FR-014）。以後 2 段階目を求めない。

### getMfaStatus

```
getMfaStatus(): Promise<{ enabled: boolean, factorId: string | null }>
```

- 設定画面・ログイン 2 段階目ページの初期表示用。`mfa.listFactors()` から phone factor を判定。
- `verified` な要素があれば `enabled: true` + その ID。無ければ未検証要素の ID（あれば）を返す。取得失敗時は `{ enabled: false, factorId: null }`（安全側）。
- 電話番号のマスク表示（`phoneMasked`）は UI 上不要のため実装しない。

## ログイン 2 段階目（チャレンジ）

### challengeLoginFactor / verifyLogin

```
challengeLoginFactor(factorId: string): Promise<ActionResult<{ challengeId: string }>>   // SMS 再送含む（FR-012）
verifyLogin(factorId: string, challengeId: string, code: string): Promise<ActionResult>  // 成功で AAL2 昇格 → redirect('/')（呼び出し元には戻らない）
```

- **フロー**: 1 段階目（`signIn`/Google）成功後、`getAuthenticatorAssuranceLevel()` が `aal1→aal2` の場合に 2 段階目 UI を表示。`challenge` で SMS 送信、`verify` で昇格し TOP（`/`）（FR-010/011）。
- **再送**: `challengeLoginFactor` の再呼び出し（クールダウン + `max_frequency`、FR-013）。

## ルートガード（AAL2 強制）

- AAL 判定は `app/(authenticated)/layout.tsx` に**一元化**する（`features/mfa/lib/aalGuard` の `isMfaChallengePending`）。
  `proxy.ts`（middleware）には判定を置かない — リクエスト毎の AAL 取得コストとリダイレクトループを避けるための設計判断（research.md Decision 6）。`proxy.ts` には `/login/verify` が AUTH_ROUTES（完全一致）に含まれず AAL1 でも到達できる旨の注記のみ追加。
  - `currentLevel==='aal1' && nextLevel==='aal2'` → 保護ルートを遮断し `/login/verify`（2 段階目チャレンジ画面）へ。
  - 2 段階目未完了で離脱してもセッションは AAL1 のまま保護コンテンツに入れない（Edge Case / FR-010）。
- 2FA 未有効化ユーザー（`nextLevel==='aal1'`）は一切変化しない（FR-015）。

## 受け入れ対応

- US2 Acceptance 1〜6 を網羅。

## 型・エラー方針

- 返却型は既存 auth アクションと同じ `ActionResult<T>`（discriminated union: `{ success: true } & T | { success: false, error: string }`）に統一する（`any` 禁止）。ユーザー向けメッセージは日本語。
