# Implementation Plan: アプリの使い方ページ

**Branch**: `worktree-030-usage-guide` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/030-usage-guide/spec.md`

## Summary

未ログイン含む全訪問者が閲覧できる「使い方ページ」（`/guide`）を service-front に追加する。既存の公開静的ページ（利用規約 / プライバシーポリシー）と同じ `(public)` ルートグループ + feature フォルダ構成を踏襲し、6 セクション（はじめに / ログ記録 / 予定・持ち物 / ダッシュボード / いいね / ログ枠と追加購入）をデータ駆動の Server Components で描画する。視覚補助はスクリーンショットではなく、表示専用の実 UI コンポーネントをサンプルデータ付きで app 層から slot 注入して例示する（feature 間 import 禁止の遵守）。導線はヘッダーナビ（モバイルはメニュー内）とフッターの両方に追加し、metadata は noIndex を付けず検索インデックスを許可する。

## Technical Context

**Language/Version**: TypeScript（strict）/ Next.js 16（App Router）/ React 19 + React Compiler

**Primary Dependencies**: Tailwind CSS・shadcn/ui・Base UI（`@repo/ui`）。新規依存の追加なし

**Storage**: N/A（静的コンテンツ。DB・Supabase の変更なし）

**Testing**: Vitest（単体）+ Storybook（story）+ Playwright + axe-core（a11y）

**Target Platform**: Web（service-front、モバイルファースト）

**Project Type**: npm workspaces モノレポ内の Next.js アプリ（`service-front/`）

**Performance Goals**: 静的な Server Components のみで構成し、追加のデータフェッチ 0 件（例示表示はハードコードされたサンプルデータを使用）

**Constraints**: WCAG 2.1 AA（見出し階層 h1→h2→h3・目次アンカー・コントラスト 4.5:1・タッチターゲット 44px）/ `app → features → shared` の依存方向・feature 間 import 禁止 / 例示表示は表示専用コンポーネントに限定（Server Action・クライアント状態を持つものは流用しない）

**Scale/Scope**: 1 ページ・6 セクション + ヘッダー / フッター導線の 2 箇所改修。新規 feature フォルダ 1 つ（`features/guide/`）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 判定 | 根拠 |
|---|---|---|
| I. Spec-Driven Development | PASS | spec.md 承認済み（clarify 4 問反映・checklist 16/16）。この plan → tasks の順で進める |
| II. Server Components First | PASS | 全コンポーネントを Server Components で実装（`'use client'` なし）。目次はページ内アンカーで JS 不要。`generatePageMetadata` で metadata をエクスポート |
| III. Test-First（テスト同梱） | PASS | GuideView 等の新規コンポーネントに Vitest 単体テスト・Storybook story を同梱し、Playwright + axe の a11y テストを追加する |
| IV. Security & RLS by Default | PASS（N/A） | DB・スキーマ変更なし。公開ページであり認証情報も扱わない |
| V. Accessibility（WCAG 2.1 AA） | PASS | 見出し階層・`nav`（目次）のラベル付け・キーボード到達性・コントラストを FR-007 の受け入れ条件として検証する |
| VI. Coding Standards | PASS | `rules/folder-structure.md` のコンポーネントフォルダ 3 点構成・Tailwind utility-first・命名規則に従う |

**Post-Design Re-check（Phase 1 完了後）**: 逸脱なし。Complexity Tracking への記載事項なし。

## Project Structure

### Documentation (this feature)

```text
specs/030-usage-guide/
├── spec.md              # 承認済み仕様
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output（コンテンツ構造定義）
├── quickstart.md        # Phase 1 output（検証手順）
├── contracts/
│   └── guide-page.md    # Phase 1 output（ページ / ナビの契約）
└── tasks.md             # Phase 2 output（/speckit-tasks で生成）
```

### Source Code (repository root)

```text
service-front/src/
├── app/
│   └── (public)/
│       └── guide/
│           └── page.tsx                     # 使い方ページ（例示コンポーネントの slot 注入もここで行う）
├── features/
│   └── guide/                               # 新規 feature
│       ├── constants.ts                     # PAGE_DATA（slug/title/description）+ GUIDE_SECTIONS（セクション定義）
│       ├── types.ts                         # GuideSection / GuideStep 型
│       ├── index.ts                         # 公開 API（GuideView, PAGE_DATA, GUIDE_SECTIONS）
│       └── components/
│           ├── GuideView/                   # ページ本体（目次 + セクション組み立て）
│           │   ├── GuideView.tsx
│           │   ├── GuideView.test.tsx
│           │   ├── GuideView.stories.tsx
│           │   └── index.ts
│           └── GuideSectionCard/            # 1 セクション（見出し + ステップ + 例示 slot + 機能導線）
│               ├── GuideSectionCard.tsx
│               ├── GuideSectionCard.test.tsx
│               ├── GuideSectionCard.stories.tsx
│               └── index.ts
├── shared/components/layout/
│   ├── Header/Header.tsx                    # ナビに「使い方」リンクを追加（モバイルメニュー含む）
│   └── Footer/Footer.tsx                    # FOOTER_LINKS に「使い方」を追加
└── tests/a11y/
    └── guide.spec.ts                        # Playwright + axe の a11y テスト
```

**Structure Decision**: 既存の公開静的ページ（`features/terms` + `app/(public)/terms`）と同型の Feature-based 構成を採用する。`(public)` ルートグループは proxy.ts の認証ガード（`APP_ROUTE_PREFIXES`）の対象外のため、**proxy.ts の変更は不要**（検証のみ行う）。例示表示に使う他 feature のコンポーネント（例: plans の `NextPlanCardView`）は feature 間 import 禁止のため `app/(public)/guide/page.tsx`（app 層）で組み立てて `GuideView` に `ReactNode` slot として注入する — TOP ダッシュボード（`TopDashboard` の `nextPlanSection` 等)と同じ確立済みパターン。

## 実装上の注意（リスク）

- **ベースブランチの鮮度**: 本ワークツリー（`worktree-030-usage-guide`）は origin/main 起点で、ローカル最新 main より古い。実装着手前に最新 main を取り込む（merge / rebase）こと。Header のナビ構成・共通見出しコンポーネント（`Heading`）等は取り込み後の実体に合わせて調整する
- **例示コンポーネントの選定**: 表示専用であることを実装時に必ず確認する（Server Action・`'use client'` の操作系を含むものは対象外）。詳細は [research.md](./research.md) Decision 4

## Complexity Tracking

> Constitution Check に違反なし。記載事項なし。
