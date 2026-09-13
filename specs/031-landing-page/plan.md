# Implementation Plan: ランディングページ（LP）

**Branch**: `worktree-031-landing-page`（基点: `develop`） | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/031-landing-page/spec.md`

## Summary

未認証の訪問者向けに、サービス紹介と新規登録導線を持つランディングページを専用 URL `/lp` に追加する。構成はヒーロー（キャッチコピー + 登録 CTA）→ 主要機能紹介（画面イメージ付き）→ 料金（基本無料 + ログパック 3 種: お試し 10 枠 480 円 / おすすめ 30 枠 1,200 円 / たっぷり 100 枠 3,000 円）→ 最下部 CTA。既存の `(public)` ルートと同じパターン（`features/landing` + `generatePageMetadata` + sitemap 登録）で実装し、`proxy.ts` はデフォルトで `/lp` を素通しするため**既存ルーティングへの変更はゼロ**。全体を Server Components のみで構成し、クライアント JS に依存しない。

## Technical Context

**Language/Version**: TypeScript（strict）/ Next.js App Router（service-front）

**Primary Dependencies**: Tailwind CSS v4、next/image、next/link（新規依存の追加なし）

**Storage**: N/A（静的コンテンツのみ。DB・マイグレーション変更なし）

**Testing**: Vitest（単体）+ Storybook（story）+ Playwright + axe-core（a11y / ルーティング検証）

**Target Platform**: Web（モバイルファースト・レスポンシブ）

**Project Type**: Web application（npm workspaces モノレポの `service-front`）

**Performance Goals**: 静的な Server Components のみで構成し追加のデータフェッチなし。画像はファーストビュー外を遅延読み込み

**Constraints**: JS 無効環境でも閲覧・遷移可能（Server Components + 静的リンクのみ）/ WCAG 2.1 AA / タッチターゲット 44×44px 以上

**Scale/Scope**: 1 ルート + feature コンポーネント 4〜5 個 + 静的画像素材 4 点程度。既存ページ変更は `sitemap.ts` への 1 エントリ追加のみ

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 判定 | 根拠 |
|------|------|------|
| I. Spec-Driven Development | ✅ Pass | spec.md → plan.md → tasks.md の順で作成。価格の実装乖離（500→300 円）は実装を真実として spec 側を訂正済み |
| II. Server Components First | ✅ Pass | LP 全体を Server Components で構成、`'use client'` なし。metadata は `generatePageMetadata` でエクスポート |
| III. Test-First（テスト同梱） | ✅ Pass | `features/landing/components/**` の各コンポーネントに Vitest + Storybook + Playwright a11y を同梱（research.md Decision 9） |
| IV. Security & RLS by Default | ✅ Pass（N/A） | DB・スキーマ変更なし。認証不要の公開静的ページで、ユーザーデータに触れない |
| V. Accessibility（WCAG 2.1 AA） | ✅ Pass | セマンティック HTML（section / h1-h2 階層）、画像 alt、コントラスト AA、キーボード遷移可能な静的リンクのみ |
| VI. Coding Standards | ✅ Pass | Feature-based（`features/landing`）、コンポーネント専用フォルダ + index.ts、Tailwind utility-first |

**Post-Design Re-Check（Phase 1 完了後）**: ✅ 違反なし。feature 間 import（landing → credits）は app 層注入で回避（Decision 3）

## Project Structure

### Documentation (this feature)

```text
specs/031-landing-page/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── routes.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
service-front/
├── public/
│   └── lp/                                  # LP 用スクリーンショット素材（新規）
│       ├── dashboard.png
│       ├── dive-log.png
│       ├── plans.png
│       └── timeline.png
└── src/
    ├── app/
    │   ├── (public)/
    │   │   └── lp/
    │   │       └── page.tsx                 # LP ルート（新規）。LOG_CREDIT_PACK を注入
    │   └── sitemap.ts                       # LP の PAGE_DATA を追加（変更）
    └── features/
        └── landing/                         # 新規 feature
            ├── components/
            │   └── server/
            │       ├── LandingHero/         # ヒーロー（キャッチコピー + 登録 CTA + ログイン導線）
            │       ├── LandingFeatures/     # 主要機能紹介（画面イメージ付き）
            │       ├── LandingPricing/      # 料金セクション（価格は props で受け取る）
            │       └── LandingCta/          # 最下部 CTA
            │           # 各フォルダ: 本体 + .test.tsx + .stories.tsx + index.ts
            ├── constants.ts                 # PAGE_DATA・コピー・機能紹介定義
            └── index.ts
```

**Structure Decision**: 既存の `(public)` グループ（contact / terms / privacy-policy）と同じ「薄い `page.tsx` + feature にコンポーネント・定数を集約」パターンを踏襲する。Header / Footer / Cookie 同意バナーはルートレイアウトが全ページに提供するため LP 側の実装は不要（FR-007 のログイン導線は Header の `AuthNav` が常時表示、FR-008 のフッターリンクは既存 `Footer` が提供。LP 本文にも Hero 内ログイン導線と最下部 CTA を重ねて置く）。

## 設計詳細

### ルーティング（FR-001 / FR-002）

- `/lp` は `proxy.ts` の `APP_ROUTE_PREFIXES`・`AUTH_ROUTES` のどちらにも該当せず、**変更なしで**未認証・認証済み双方が閲覧可能（research.md Decision 2）
- トップ URL・既存ページには一切触れない（FR-002 は「変更しないこと」で満たす）

### コンテンツとデータフロー

- コピー・機能紹介・画像パスは `features/landing/constants.ts` に静的定義（データフェッチなし）
- 料金の数値は `page.tsx` が `features/credits` の `LOG_CREDIT_PACKS` から読み取り `LandingPricing` に props 注入（feature 間 import 回避 / research.md Decision 3・4）
- 無料枠の説明（初期 10 枠・デイリーボーナス 1 枠）も同様に `INITIAL_GRANT_AMOUNT` / `DAILY_BONUS_AMOUNT` を注入

### metadata / SEO（FR-009）

- `PAGE_DATA = { slug: '/lp', title, description }` を `features/landing/constants.ts` に定義し、`generatePageMetadata(PAGE_DATA)` でエクスポート（noIndex なし = インデックス許可）
- `sitemap.ts` の静的ページ一覧に LP の `PAGE_DATA` を追加
- OG 画像は共通 `/og-image.png` を流用（research.md Decision 6）

### アクセシビリティ / レスポンシブ（FR-010 / FR-011）

- `h1`（ヒーロー）→ `h2`（各セクション）の階層。セクションは `aria-labelledby` 付き `<section>`
- CTA は `next/link` + ボタン風スタイル、最小 44×44px、コントラスト AA
- スクリーンショットには内容を説明する alt（例:「ダッシュボード画面: 累計ダイブ数と統計グラフ」）
- 見出しスタイルは develop 現行の Tailwind 直書き（`Heading` コンポーネントは未マージの feat/design-change のみのため使わない / research.md Decision 7）

## Complexity Tracking

> Constitution Check に違反なしのため記載事項なし
