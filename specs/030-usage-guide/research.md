# Research: アプリの使い方ページ

**Date**: 2026-07-08 | **Plan**: [plan.md](./plan.md)

Technical Context に NEEDS CLARIFICATION はなし。設計判断が必要な論点をコードベース調査で解消した。

## Decision 1: ルートパスとルートグループ

- **Decision**: `/guide` を `app/(public)/guide/page.tsx` に配置する
- **Rationale**: `(public)` ルートグループには既に利用規約（`/terms`）・プライバシーポリシー（`/privacy-policy`）という「未ログイン閲覧可の静的ページ」が存在し、同型の要件（FR-001）に最適。proxy.ts の認証ガードは `APP_ROUTE_PREFIXES = ['/dives', '/dive-sites', '/plans', '/settings']` + TOP（`/`）完全一致のホワイトリスト方式のため、`/guide` は**変更なしで未ログイン閲覧可**になる
- **Alternatives considered**:
  - `/help` — 「ヘルプ」は FAQ・問い合わせを連想させる。本ページは操作ガイドなので guide が適切
  - `/how-to-use` — 長い。既存ルートの命名（単語 1 つ）と不揃い

## Decision 2: コンテンツ管理方式

- **Decision**: `features/guide/constants.ts` に GUIDE_SECTIONS（セクション id・タイトル・ステップ・導線）をデータとして定義し、Server Components で描画する静的 TSX 構成
- **Rationale**: spec の前提（静的コンテンツ・リリース同時更新・CMS スコープ外）に合致。データ駆動にすることで目次とセクションの二重管理を防ぎ（同一配列から生成）、セクション追加が定数の追記で済む。terms feature（`PAGE_DATA` + View コンポーネント）の確立済みパターンの拡張
- **Alternatives considered**:
  - MDX — 依存追加とビルド設定変更が必要。6 セクション規模では過剰
  - DB / CMS 管理 — spec で明示的にスコープ外

## Decision 3: 目次（ページ内ナビゲーション）

- **Decision**: セクション見出しに `id` を付与し、ページ先頭の `<nav aria-label="目次">` からアンカーリンク（`#section-id`）で移動する。JS 不要・Server Components のまま
- **Rationale**: FR-003（目次から各セクションへ移動）はアンカーで満たせる。`'use client'` 不要で Constitution II に適合。スクリーンリーダーでも nav ランドマーク + リンクで到達可能（FR-007）
- **Alternatives considered**:
  - スクロール連動のハイライト付き目次（client component）— UX 向上はあるが初版の要件外。Server Components First に反する追加 JS

## Decision 4: 視覚補助 = 実 UI コンポーネントの流用方式（clarify Q3 の実現手段）

- **Decision**: 例示表示は **app 層（`app/(public)/guide/page.tsx`）でサンプルデータを与えて組み立て、`GuideView` / `GuideSectionCard` に `ReactNode` slot として注入**する。流用は「表示専用（Server Action・クライアント操作を持たない）」コンポーネントに限定する
- **Rationale**:
  - feature 間 import 禁止（アーキテクチャ規約）のため、guide feature から plans / dives / dashboard のコンポーネントを直接 import できない。TOP の `TopDashboard`（`nextPlanSection` / `timelineSection` slot）で確立済みの注入パターンを踏襲する
  - 操作系コンポーネント（チェック操作・Server Action 付き）を未ログインページに置くと認証前提の動作が壊れるため、表示専用に限定する
- **確定した選定（実装時に表示専用性を確認済み）**:
  - `dive-logs`: dashboard feature の `RecentDives`（サンプルログ 3 件）。カードがログ詳細へのリンクを持ちサンプル id では実在しないため、`inert` 属性でフォーカス・操作対象から外す（axe の aria-hidden-focus 違反も回避）
  - `dashboard`: shared の `BarChart`（サンプル年別本数）。非対話 SVG・`aria-label` 付きでそのまま利用可
  - `plans-packing`: 候補だった plans の `NextPlanCardView` は操作系（Server Action 付き `PackingChecklist`）を内包するため対象外 → テキストのみ（FR-009 のフォールバック）
- **Alternatives considered**:
  - guide feature から直接 import — 規約違反のため不可
  - 静的スクリーンショット — clarify Q3 で不採用が確定
  - Storybook の iframe 埋め込み — 本番に Storybook を同梱しない方針のため不可

## Decision 5: ナビゲーション導線の追加箇所（clarify Q2 の実現手段）

- **Decision**: ヘッダーの `nav`（デスクトップ）+ モバイルメニュー、フッターの `FOOTER_LINKS` 配列の 3 箇所に「使い方」（`/guide`）を追加する
- **Rationale**: FR-006 の確定事項。Footer はリンク配列（`FOOTER_LINKS`）へ 1 エントリ追加のみ。Header は実装時点の最新 main のナビ構成（モバイルメニュー含む）に合わせて追加する
- **Alternatives considered**: なし（clarify で確定済み）

## Decision 6: metadata と検索インデックス（clarify Q4 の実現手段）

- **Decision**: `generatePageMetadata(PAGE_DATA)` を **noIndex オプションなし**で使用する（既定でインデックス許可）。PAGE_DATA は terms 同様 `features/guide/constants.ts` に定義する
- **Rationale**: FR-010 の確定事項。サイト共通 metadata（`SITE_METADATA`）は `robots.index: true` が既定で、認証必須ページだけが `{ noIndex: true }` を渡している。公開ページは terms / privacy-policy と同じく素の `generatePageMetadata` で足りる
- **Alternatives considered**: なし（clarify で確定済み）

## Decision 7: テスト構成

- **Decision**: GuideView / GuideSectionCard に Vitest 単体テスト + Storybook story を同梱し、`tests/a11y/guide.spec.ts` に Playwright + axe-core の a11y テスト（未ログインでの表示・違反 0 件・目次アンカー動作）を追加する
- **Rationale**: Constitution III（テスト同梱）と FR-007（WCAG AA）の受け入れ検証。既存の `tests/a11y/*.spec.ts` パターンを踏襲
- **Alternatives considered**: E2E での全導線検証 — ヘッダー / フッターのリンク存在は Vitest（Header / Footer 既存テストの更新）で担保し、E2E は a11y 検証に絞る
