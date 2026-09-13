# Contract: 同意ユーティリティ & store

**Feature**: [../spec.md](../spec.md) | **Plan**: [../plan.md](../plan.md)

`service-front/src/features/consent/lib/` の契約。同意状態の参照・書き込みを一元化し、gating の単一参照点とする。

## `cookie-consent.ts`

### 定数

| 名前 | 値 | 備考 |
|------|----|------|
| `COOKIE_CONSENT_NAME` | `'cookie-consent'` | Cookie 名 |
| `COOKIE_CONSENT_MAX_AGE_SECONDS` | `60 * 60 * 24 * 365` | 約 12 か月（FR-005） |

### 型

```ts
type ConsentState = 'accepted' | 'rejected';
// 「未選択」は null で表す（Cookie 未設定 / 期限切れ / 破損値）
```

### 関数

| 関数 | 実行環境 | 役割 |
|------|----------|------|
| `getCookieConsentClient(): ConsentState \| null` | Client | `document.cookie` を読み、`accepted`/`rejected` 以外は `null` を返す |
| `getCookieConsentServer(cookieValue: string \| undefined): ConsentState \| null` | Server | レイアウトが `cookies().get()` で得た値を正規化（純関数でテスト容易） |
| `serializeConsentCookie(state: ConsentState, isSecure: boolean): string` | 純関数 | 書き込む Cookie 文字列を組み立てる（属性を単体テストできるよう `setCookieConsent` から分離） |
| `setCookieConsent(state: ConsentState): void` | Client | `serializeConsentCookie` の結果を `document.cookie` に書き込む（Max-Age/Path/SameSite、本番は Secure） |

**契約条件**:
- 値が `accepted` / `rejected` 以外（破損・改ざん）の場合は必ず `null` を返す（FR: 破損時は再表示）
- `setCookieConsent` は本番（https）で `Secure`、`SameSite=Lax`、`Path=/`、`Max-Age=COOKIE_CONSENT_MAX_AGE_SECONDS` を必ず付ける
- 同意状態の判定は他所で `document.cookie` を直接パースせず、必ず本ユーティリティを経由する（gating の単一参照点）

### gating ヘルパ（将来の非必須ローダ向け）

`gating.ts` に被ゲート処理用のヘルパ `runWhenConsented` を用意する（規約を関数化し単一参照点に集約）。

```ts
// runWhenConsented(loader): 同意済みのときだけ loader を実行し true、拒否/未選択は false
runWhenConsented(() => loadAnalytics());
```

| 関数 | 役割 |
|------|------|
| `runWhenConsented(loader: () => void): boolean` | `getCookieConsentClient() === 'accepted'` のときだけ `loader` を実行し `true`、拒否/未選択では実行せず `false` を返す |

現状は非必須 Cookie が無いため、テストではダミーの `loader` で「同意でのみ実行」を検証する。

## `store.ts`（zustand）

```ts
interface CookieConsentStore {
    /** フッター「Cookie 設定」からの再表示シグナル */
    forcedOpen: boolean;
    openSettings: () => void; // forcedOpen = true
    close: () => void;        // forcedOpen = false
}
```

**契約条件**:
- `openSettings()` 後はバナーが（同意済みでも）再表示される
- `close()` は選択完了・キャンセルでバナーを閉じる側がリセットに使う

## テスト観点（Vitest）

- `getCookieConsentClient`：`accepted` / `rejected` / 未設定 / 破損値（`foo`）→ それぞれ正しい返り値（破損は null）
- `getCookieConsentServer`：同上（純関数）
- `serializeConsentCookie`：Cookie 文字列に Max-Age(365日) / Path / SameSite が含まれ、`isSecure=true` で Secure を付与
- `setCookieConsent`：書き込んだ値を `getCookieConsentClient` で読み戻せる
- `runWhenConsented`：同意=loader 実行・true / 拒否・未選択=未実行・false
- `store`：`openSettings` → `forcedOpen=true`、`close` → `false`
