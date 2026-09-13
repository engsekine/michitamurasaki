# Implementation Plan: Cookie 同意バナー

**Branch**: `017-cookie-consent` | **Date**: 2026-06-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/017-cookie-consent/spec.md`

## Summary

全ページ共通の**非ブロッキング Cookie 同意バナー**を実装する。同意状態は Cookie（`cookie-consent` = `accepted` / `rejected`、Max-Age 約 365 日）に保存し、ルートレイアウト（Server Component）が読んで「未設定のときだけ」バナーを描画することでちらつきを防ぐ（FR-011）。操作は「同意する」「拒否する」「プライバシーポリシーリンク」のみ（閉じる ✕ なし）。フッターの「Cookie 設定」から zustand 経由で再表示できる。非必須 Cookie は現状ゼロのため、`getCookieConsent()` を参照点とする **gating の枠組み**を用意し、将来の非必須ローダがそこを通す規約とする。DB・Supabase 変更は無し。

## Technical Context

**Language/Version**: TypeScript（strict mode）/ Next.js App Router / React（React Compiler 有効）

**Primary Dependencies**: 既存のみ（追加なし）。zustand（再表示シグナルの共有）、Tailwind CSS、`@repo/ui` の Button

**Storage**: ブラウザ Cookie のみ（`cookie-consent`、`SameSite=Lax` / `Secure`（本番）/ `Path=/`、非 httpOnly）。**DB / Supabase / マイグレーションは不要**

**Testing**: Vitest（cookie ユーティリティ・store・コンポーネント）、Storybook、Playwright（E2E + axe-core a11y）

**Target Platform**: Web（service-front: Next.js アプリケーション）。未ログイン訪問者・ログインユーザー双方で機能

**Project Type**: Web application（service-front 単体。バックエンド変更なし）

**Performance Goals**: 特別な性能要件なし。FR-011 のちらつき防止（同意前コンテンツの一瞬の表示・大きなレイアウトシフトを起こさない）をサーバー判定で担保

**Constraints**: 非ブロッキング（モーダルにしない・フォーカストラップしない、FR-014）。同意の参照は `getCookieConsent()` に一元化。`prefers-reduced-motion` を尊重。WCAG 2.1 AA

**Scale/Scope**: 新規コンポーネント 2（`CookieConsentBanner` / `CookieSettingsButton`）+ cookie ユーティリティ + zustand store + ルートレイアウトとフッターへの組み込み。非必須 Cookie の実体は本フェーズ対象外（枠組みのみ）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` v1.0.0 準拠で評価。

| 原則 | 準拠状況 |
|------|---------|
| I. Spec-Driven Development | spec.md → plan.md → （tasks.md）の順で進行。違反なし |
| II. Server Components First | 同意要否の判定はルートレイアウト（Server）で実施。バナー/設定ボタンはインタラクションのため最小 Client。違反なし |
| III. Test-First | `CookieConsentBanner` / `CookieSettingsButton` は Vitest + Storybook + Playwright a11y を同梱。cookie ユーティリティ・store は Vitest。違反なし |
| IV. Security & RLS by Default | DB 変更なし（RLS 対象外）。同意 Cookie は非機密のため非 httpOnly とする（理由を data-model に明記）。違反なし |
| V. Accessibility（WCAG 2.1 AA） | 非モーダル領域 + ランドマーク、ボタンはアクセシブル名、キーボード操作完結、コントラスト 4.5:1、`prefers-reduced-motion` 尊重。違反なし |
| VI. Coding Standards | TypeScript strict / `any` 禁止、Feature-based（`features/consent`）、Tailwind utility-first、命名規約。違反なし |

**判定**: 違反なし。Complexity Tracking 記載なし。

## Project Structure

### Documentation (this feature)

```text
specs/017-cookie-consent/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0: 保存先/ノーフラッシュ/gating 枠組み 等の判断
├── data-model.md        # Phase 1: 同意状態（Cookie）と Cookie カテゴリの定義
├── quickstart.md        # Phase 1: 検証手順（表示/記録/再表示しない/gating/a11y）
├── contracts/           # Phase 1: コンポーネント & ユーティリティの契約
│   ├── components.md
│   └── consent-util.md
└── tasks.md             # Phase 2 出力（/speckit-tasks。本コマンドでは作らない）
```

### Source Code (repository root)

```text
service-front/src/
├── app/
│   └── layout.tsx                      # ★変更: cookie を読み <CookieConsentBanner initialConsent={...}> を mount
├── features/consent/
│   ├── components/client/
│   │   ├── CookieConsentBanner/        # ★新規: 非ブロッキング帯（同意/拒否/ポリシーリンク）+ test/stories/index
│   │   └── CookieSettingsButton/       # ★新規: フッター用「Cookie 設定」再表示ボタン + test/stories/index
│   ├── lib/
│   │   ├── cookie-consent.ts           # ★新規: 定数・read/write・getCookieConsent（client/server）
│   │   ├── cookie-consent.test.ts
│   │   ├── store.ts                    # ★新規: zustand（forcedOpen / openSettings / close）
│   │   └── store.test.ts
│   └── index.ts                        # ★新規: 公開エクスポート
└── shared/components/layout/Footer/Footer.tsx  # ★変更: CookieSettingsButton を追加

service-front/tests/a11y/
└── cookie-consent.spec.ts              # ★新規: バナー表示時の a11y（または public-pages に内包）
```

**Structure Decision**: Feature-based（憲章 VI）に従い、同意関連は `service-front/src/features/consent/` に集約する。バナーは全ページ共通のためルートレイアウトに mount し、同意要否はサーバーで判定（ノーフラッシュ）。フッターの再表示ボタンとバナーは zustand store で連携。DB レイヤーは触らない。

## 設計の詳細

### コンポーネントと責務（[contracts/components.md](contracts/components.md) 参照）

| 要素 | 種別 | 責務 |
|------|------|------|
| `app/layout.tsx` | Server | `cookies().get('cookie-consent')` を読み、`initialConsent` を `CookieConsentBanner` に渡す |
| `CookieConsentBanner` | Client | `initialConsent===null` か `forcedOpen` のとき非ブロッキング帯を表示。同意/拒否で Cookie 書き込み + 非表示。ポリシーリンク |
| `CookieSettingsButton` | Client | フッターに配置。押下で store の `openSettings()` を呼びバナーを再表示 |
| `cookie-consent.ts` | util | Cookie 名/Max-Age 定数、`getCookieConsent()`（client は `document.cookie`、server は `cookies()`）、`setCookieConsent('accepted'\|'rejected')` |
| `store.ts` | zustand | `{ forcedOpen, openSettings(), close() }` |

### 表示判定（ノーフラッシュ）

```text
表示する = (initialConsent === null && !decidedThisSession) || forcedOpen
```
- `initialConsent` はサーバーが Cookie から決定（未設定/期限切れ → null）
- `decidedThisSession` はこのセッションで同意/拒否した直後にバナーを隠すためのローカル状態
- `forcedOpen` はフッター「Cookie 設定」からの再表示

### gating の枠組み（非必須 Cookie は現状ゼロ）

- 非必須スクリプト/Cookie ローダは **`getCookieConsent() === 'accepted'` を確認してから**実行する規約とする。これをヘルパ `runWhenConsented(loader)`（`features/consent/lib/gating.ts`）に集約し、同意済みのときだけ `loader` を実行する
- 現状対象が無いため、SC-003 はダミーの被ゲート処理（`runWhenConsented` に渡す spy）で「拒否/未選択では走らない・同意で走る」ことを検証する

### アクセシビリティ

- バナーは非モーダルのランドマーク（`role="region"` 相当 + `aria-label="Cookie の利用について"`）。`aria-modal` は付けない（FR-014）
- 「同意する」「拒否する」は実ボタン、リンクは実 `<a>`。キーボードで全操作可能・フォーカストラップなし
- コントラスト 4.5:1 以上、`prefers-reduced-motion` でアニメーション抑制

### セキュリティ / プライバシー

- 同意 Cookie は非機密のため非 httpOnly（クライアントの gating 参照に必要）。`SameSite=Lax` / 本番 `Secure`
- DB に同意ログは残さない（v1 スコープ外）。サーバーは Cookie を読むのみ

## Complexity Tracking

Constitution Check に違反なしのため、記載事項なし。
