# Contract: 認証アプリ（TOTP）2 要素認証（service-front / US2）

> 2026-10-09: SMS（phone factor）から TOTP へ移行。送信工程が無くなったため challenge / verify は `challengeAndVerify` に統合し、再送 API は廃止した。

`service-front/src/features/mfa/`。MFA の enroll/verify/disable と、ログイン 2 段階目のチャレンジを担う。操作系はすべて **サーバーアクション**（`features/mfa/server/actions.ts` / `'use server'`）に集約し、Client Component（`MfaChallengeForm` / `TwoFactorSettings`）はそれを呼び出す構成とした。

## 有効化（設定画面）

### enrollTotpFactor

```
enrollTotpFactor(): Promise<ActionResult<{ factorId: string, qrCode: string, secret: string }>>
```

- **目的**: 認証アプリ用の要素を登録し、QR コードとシークレットを返す（FR-008/009）。
- **処理**: 先に `mfa.listFactors()` で未検証（`status !== 'verified'`）の要素を `mfa.unenroll` で片付けてから、`mfa.enroll({ factorType: 'totp', issuer: 'ダイビングログ', friendlyName: '認証アプリ' })`。`qrCode` は supabase-js が `data:image/svg+xml;utf-8,` 付きで返す SVG データ URL（`<img src>` にそのまま使える）。
- **なぜ未検証要素を先に解除するか**: Supabase は同じ friendly name の要素が残っていると enroll を 422 で拒否する。設定を途中離脱したユーザーが二度と設定を始められなくなるのを防ぐ（Edge Case）。
- **失敗**: 「認証アプリの設定を開始できませんでした。時間をおいて再度お試しください」。

### verifyTotpFactor

```
verifyTotpFactor(factorId: string, code: string): Promise<ActionResult>
```

- **処理**: `mfa.challengeAndVerify({ factorId, code })`。成功で要素が `verified`＝2FA 有効化（FR-009）。
- **失敗**: 誤コード/期限切れは拒否して再入力（FR-011 相当）。429 は「試行回数が多すぎます。しばらく時間をおいてからお試しください」（FR-013）。

### disableTotpFactor

```
disableTotpFactor(factorId: string): Promise<ActionResult>
```

- **処理**: `mfa.unenroll({ factorId })`（FR-014）。以後 2 段階目を求めない。

### getMfaStatus

```
getMfaStatus(): Promise<{ enabled: boolean, factorId: string | null }>
```

- 設定画面・ログイン 2 段階目ページの初期表示用。`mfa.listFactors()` の `totp` から判定。
- `verified` な要素があれば `enabled: true` + その ID。無ければ `{ enabled: false, factorId: null }`（未検証要素は enroll 時に自動解除されるため返さない）。取得失敗時も `{ enabled: false, factorId: null }`（安全側）。

## ログイン 2 段階目（チャレンジ）

### verifyLogin

```
verifyLogin(factorId: string, code: string): Promise<ActionResult>  // 成功で AAL2 昇格 → redirect('/')（呼び出し元には戻らない）
```

- **フロー**: 1 段階目（`signIn`/Google）成功後、AAL 判定が `aal1→aal2` の場合に 2 段階目 UI を表示。`challengeAndVerify` で昇格し TOP（`/`）（FR-010/011）。
- **再送**: 無し。TOTP はアプリ側でコードが 30 秒ごとに再生成される（FR-012 廃止）。
- **レート制限**: 429 を「試行回数が多すぎます」として返す（FR-013）。

## ルートガード（AAL2 強制）

- AAL 判定は `app/(authenticated)/layout.tsx` に**一元化**する（`features/mfa/lib/aalGuard` の `isMfaChallengePending`、実体は `@repo/supabase/aal`）。
  `proxy.ts`（middleware）には判定を置かない — リクエスト毎の AAL 取得コストとリダイレクトループを避けるための設計判断（research.md Decision 6）。`proxy.ts` には `/login/verify` が AUTH_ROUTES（完全一致）に含まれず AAL1 でも到達できる旨の注記のみ追加。
  - `currentLevel==='aal1' && nextLevel==='aal2'` → 保護ルートを遮断し `/login/verify`（2 段階目チャレンジ画面）へ。
  - 2 段階目未完了で離脱してもセッションは AAL1 のまま保護コンテンツに入れない（Edge Case / FR-010）。
- 2FA 未有効化ユーザー（`nextLevel==='aal1'`）は一切変化しない（FR-015）。

## 受け入れ対応

- US2 Acceptance 1〜4・6・7 を網羅（5 は TOTP 化で廃止）。

## 型・エラー方針

- 返却型は既存 auth アクションと同じ `ActionResult<T>`（discriminated union: `{ success: true } & T | { success: false, error: string }`）に統一する（`any` 禁止）。ユーザー向けメッセージは日本語。
