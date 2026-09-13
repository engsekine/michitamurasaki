# Research: ランディングページ（LP）

**Date**: 2026-07-08 | **Feature**: [spec.md](./spec.md)

## Decision 1: ワークツリー・ベースブランチ

- **Decision**: `develop`（PR #34 / 028-deploy-pipeline まで反映済み）を基点に実装する
- **Rationale**: `origin/main` は PR #3 時点で停止しており実態と乖離。`feat/design-change`（Heading・デザイン刷新）は未マージのため、依存すると stacked PR になる。ユーザーが develop 基点を選択（2026-07-08）
- **Alternatives considered**: `feat/design-change` 基点（新デザイン言語と一貫するが、マージ順序の依存が生じるため見送り）

## Decision 2: ルーティング配置 — `(public)/lp` / proxy 変更不要

- **Decision**: ルートは `service-front/src/app/(public)/lp/page.tsx`（URL: `/lp`）に置く。`proxy.ts` は変更しない
- **Rationale**: `proxy.ts` は `APP_ROUTE_PREFIXES`（認証必須）と `AUTH_ROUTES`（認証済みを `/dives` へ飛ばす）に該当しないパスをデフォルトで素通しする。`/lp` はどちらにも該当しないため、**未認証・認証済みの双方がそのまま閲覧できる**（FR-001・US2-AC3 を追加コードなしで満たす）。既存の `(public)` グループ（contact / terms / privacy-policy）と同じ扱いで、トップ URL の挙動（FR-002）にも一切触れない
- **Alternatives considered**: 専用 route group `(marketing)` の新設（レイアウト分岐が不要なため過剰）、proxy への明示的な公開パス追加（デフォルト公開なので不要）

## Decision 3: feature フォルダ構成と価格の参照方法

- **Decision**: `service-front/src/features/landing/` を新設し、セクションコンポーネント（Server Components）と `constants.ts`（PAGE_DATA・コピー・機能紹介定義）を置く。**料金の具体額は `features/credits` の `LOG_CREDIT_PACK` を唯一の情報源とし、feature 間 import 禁止のため `page.tsx`（app 層）で読み取って LP コンポーネントに props で注入する**
- **Rationale**: Feature-based アーキテクチャ（`arch/feature-based.md`）の feature 間 import 禁止に従う。ダッシュボード `page.tsx` が `CreditBalanceBadge` を注入している既存パターンと同型。価格をハードコードすると改定時に乖離する（FR-005 の「販売定義と常に一致」を定数参照で保証）
- **Alternatives considered**: `features/landing` 内に価格を再定義（二重管理になり FR-005 違反リスク）、`shared/` へ価格定数を移動（credits ドメインの知識を shared に漏らすため見送り）

## Decision 4: 価格表記の訂正（500 円 → 300 円）

- **Decision**: LP に表示する料金は「基本無料（初期 10 枠 + デイリーボーナス）/ ログパック 10 枠 300 円」とする
- **Rationale**: 実装（`LOG_CREDIT_PACK = { quantity: 10, amountJpy: 300 }`）が真実。spec 当初の「10 枚 500 円」は `docs/product.md` の構想時の値で、026-log-monetization の実装時に 300 円で確定している。spec は訂正済み
- **Alternatives considered**: なし（constitution I: 実装と仕様がズレた場合は実装が真実）

## Decision 5: 画面イメージ素材

- **Decision**: スクリーンショットは `service-front/public/lp/` 配下に静的画像（例: `dashboard.png` / `dive-log.png` / `plans.png` / `timeline.png`）として置き、`next/image` で表示する。ファーストビュー外のセクション画像は遅延読み込み（デフォルト動作）、装飾でない画像には内容を説明する alt を付ける
- **Rationale**: FR-004a（画面イメージ）を静的素材で満たす（spec Assumption: 実データの動的取得はしない）。`proxy.ts` の matcher は画像拡張子を除外済みで追加設定不要
- **Alternatives considered**: 実画面の iframe / 動的レンダリング（認証・データ依存が生じ Edge Case「データ取得失敗で LP が壊れない」に反する）
- **Open item（実装タスクで対応）**: スクリーンショットの撮影・整形は実装フェーズの素材準備タスクとする。開発環境のシードデータで撮影する

## Decision 6: metadata / SEO / sitemap

- **Decision**: `generatePageMetadata`（`@/shared/config/metadata`）で `PAGE_DATA`（slug: `/lp`）から metadata を生成し、**noIndex は付けない**（検索インデックス許可）。`src/app/sitemap.ts` に LP の `PAGE_DATA` を追加する。OG 画像はサイト共通の `/og-image.png` を流用する
- **Rationale**: FR-009（検索・SNS 向けメタ情報）。既存の terms / privacy-policy と同じ実装パターン（feature の `PAGE_DATA` を sitemap が import）に揃える
- **Alternatives considered**: LP 専用 OG 画像の新規制作（訴求上は望ましいが素材制作が別途必要。共通 OG 画像で FR-009 は満たせるため初期リリースでは流用し、将来差し替え）

## Decision 7: 見出し・デザイン言語

- **Decision**: develop には共通 `Heading` コンポーネントが存在しないため、LP 内の見出しは素の `h1`/`h2` + Tailwind（既存ページと同じ `font-semibold text-2xl` 系）で実装する
- **Rationale**: `Heading` は未マージの `feat/design-change` にのみ存在し、依存すると Decision 1 に反する。LP のセクション見出しはコンポーネント境界が明確なので、design-change マージ後の置換コストは小さい
- **Alternatives considered**: Heading を LP ブランチに複製（同一コンポーネントの二重定義となりマージ時に衝突するため見送り）

## Decision 8: クライアント JS 非依存

- **Decision**: LP は全体を Server Components のみで構成し、`'use client'` を使わない。CTA・ログイン導線はすべて `next/link` の静的リンクとする
- **Rationale**: constitution II（Server Components First）と Edge Case「JavaScript が無効な環境でも主要コンテンツの閲覧と遷移ができること」を構造的に満たす。LP にインタラクションは不要
- **Alternatives considered**: スクロールアニメーション等の演出（client 化と `prefers-reduced-motion` 対応が必要になる。訴求への寄与が薄いため初期スコープ外）

## Decision 9: テスト戦略

- **Decision**: 各セクションコンポーネントに Vitest 単体テスト + Storybook story を同梱し（`/generate-with-tests` 活用）、ページ全体は Playwright + axe-core で「未認証で `/lp` が 200 で表示される」「見出し階層・a11y 違反 0」「CTA リンクの遷移先」を検証する。既存挙動の退行（FR-002）は「未認証で `/` → `/login` リダイレクト」の既存テストが担保（変更しないため）
- **Rationale**: constitution III（Test-First・テスト同梱）と SC-006（a11y 重大違反 0）
- **Alternatives considered**: E2E のみ（コンポーネント規約違反になるため不可）
