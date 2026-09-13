# Contract: コンポーネント

**Feature**: [../spec.md](../spec.md) | **Plan**: [../plan.md](../plan.md)

`service-front/src/features/consent/components/client/` の契約。

## `CookieConsentBanner`

非ブロッキングの同意バナー。ルートレイアウトに mount される。

### Props

| Prop | 型 | 説明 |
|------|----|------|
| `initialConsent` | `'accepted' \| 'rejected' \| null` | サーバーが Cookie から判定した初期同意状態 |

### 表示条件

```text
表示する = (initialConsent === null && !decidedThisSession) || store.forcedOpen
```

### 振る舞い

| 操作 | 結果 |
|------|------|
| 「同意する」押下 | `setCookieConsent('accepted')` → バナー非表示（`decidedThisSession=true` / `store.close()`） |
| 「拒否する」押下 | `setCookieConsent('rejected')` → バナー非表示 |
| プライバシーポリシーリンク | `/privacy-policy` へ遷移（FR-001） |

### アクセシビリティ契約

- ルート要素は非モーダルのランドマーク（`role="region"` 相当）+ `aria-label="Cookie の利用について"`。`aria-modal` を付けない（FR-014）
- 「同意する」「拒否する」は実 `<button>`、リンクは実 `<a>`。キーボードで全操作可能・フォーカストラップなし（FR-011 / FR-015）
- 独立した「閉じる ✕」は持たない（FR-015）
- `prefers-reduced-motion: reduce` で出現アニメーションを無効化

### 受け入れ対応
FR-001/002/003/004/006/007/011/014/015、US1〜US3

## `CookieSettingsButton`

フッターに置く「Cookie 設定」再表示ボタン。

### 振る舞い

| 操作 | 結果 |
|------|------|
| 押下 | `store.openSettings()` を呼びバナーを再表示（同意済みでも） |

### アクセシビリティ契約
- 実 `<button>`、アクセシブル名「Cookie 設定」。キーボード操作可能

### 受け入れ対応
FR-009、US4

## ルートレイアウト（`app/layout.tsx`）への組み込み

- サーバーで `cookies().get(COOKIE_CONSENT_NAME)?.value` を取得し `getCookieConsentServer()` で正規化、`<CookieConsentBanner initialConsent={...} />` を `<body>` 内（フッターの近く）に mount する
- これによりバナー要否はサーバー描画時に確定し、ちらつかない（FR-011）

## テスト観点

- **Vitest（Banner）**: `initialConsent` 別の表示/非表示、同意/拒否で `setCookieConsent` 呼び出し + 非表示、ポリシーリンクの href、`forcedOpen` での再表示
- **Vitest（SettingsButton）**: 押下で `openSettings` 呼び出し
- **Storybook**: 未選択（表示）/ 同意済み（非表示）/ 強制再表示
- **Playwright a11y**: バナー表示状態で WCAG 2.1 AA 違反ゼロ
