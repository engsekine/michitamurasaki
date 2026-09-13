# Diving Log App Constitution

ダイビングログアプリ（service-front + Supabase）のプロジェクト原則。`/speckit-plan` の Constitution Check はこのファイルを基準に行う。

## Core Principles

### I. Spec-Driven Development（spec-kit が正）

すべての機能は `specs/NNN-feature-name/` 配下の spec.md → plan.md → tasks.md の順で仕様を確定してから実装する。実装と仕様がズレた場合は、実装を真実として仕様書側を更新する。旧 `docs/specs/` は `specs/` へ移行完了し削除済み。

### II. Server Components First

Next.js App Router を使用し、Server Components をデフォルトとする。Client Components は `'use client'` で明示的に指定し、インタラクションが必要な最小範囲に限定する。データフェッチは Server Components / Server Actions で行い、ページは `generatePageMetadata`（`@/shared/config/metadata`）で metadata をエクスポートする。

### III. Test-First（テスト同梱）

実装コードの変更前にテストを書く。`src/shared/components/**` / `src/features/*/components/**` のコンポーネントは Vitest 単体テスト・Storybook story・Playwright a11y テストを必ず同梱する（`/generate-with-tests` で生成）。バグ修正には回帰テストを追加する。テストは Vitest を使用する。

### IV. Security & RLS by Default

`public` スキーマの全テーブルで RLS を有効化し、ユーザーデータは `(select auth.uid())` ベースのポリシーで本人のみアクセス可能にする。スキーマ変更はマイグレーション SQL ファイル経由のみ（本番 DB への直接 DDL 禁止）。関数は `set search_path = ''` を必須とする。詳細は `.claude/rules/sql.md` に従う。

### V. Accessibility（WCAG 2.1 AA）

セマンティック HTML を基本とし、キーボード操作・スクリーンリーダー対応・カラーコントラスト 4.5:1 以上を満たす。フォームは label 関連付け・エラーの `role="alert"`・`aria-invalid` を徹底する。詳細は `.claude/rules/accessibility.md` に従う。

### VI. Coding Standards（rules/ 準拠）

コーディング規約は `.claude/rules/` を正とする: TypeScript strict mode・`any` 禁止（`typescript.md`）、Feature-based アーキテクチャとコンポーネントフォルダ構成（`react.md` + `.claude/CLAUDE.md`）、Tailwind CSS utility-first（`css.md`）、snake_case / 3NF / timestamptz（`sql.md`）、命名は `readable-code.md` に従う。

## Product Direction

Web 上でダイビングのログ（ログブック）を作成・管理できるアプリ。機能の実装状況は `specs/` が正であり、ここには仕様書に閉じないプロダクト方針だけを置く（旧 `docs/product.md` から移管）。

- **収益はログパックの買い切り販売のみ**: ログ枠制 + デイリーボーナス（1 日 1 枠）+ Stripe Checkout によるログパック購入（`specs/026-log-monetization/`）。価格は実装（`LOG_CREDIT_PACKS`）が正
- **広告なしは恒久方針**: 無料ユーザーへの広告表示による収益化は行わない（026 で明文化）
- **将来構想（未着手）**: 海洋データ（海水温など）の販売。ダイビングスポットのマスタ化は `specs/011-dive-sites-master/` で実装済み

## Technology Stack

- フロントエンド: Next.js（App Router）/ TypeScript / Tailwind CSS / React Compiler
- バックエンド: Supabase（PostgreSQL + Auth + RLS）
- フォーム: React Hook Form + yup
- テスト: Vitest / Storybook / Playwright（axe-core）
- アーキテクチャ: Feature-based（`service-front/arch/feature-based.md` 参照）

## Development Workflow

1. `/speckit-specify` で spec.md を作成し要件を合意する
2. `/speckit-plan` で plan.md（+ data-model.md 等）を作成し設計を確定する
3. `/speckit-tasks` で tasks.md にタスク分解する
4. `/speckit-implement` または手動で実装する（テストファースト）
5. コミット前に `/review` と仕様書同期確認を行う

コミットメッセージは Conventional Commits（`feat:` / `fix:` / `docs:` / `refactor:` / `test:` / `chore:`）に従う。

## Governance

- この constitution はその他のプラクティスに優先する。改定は本ファイルの変更 + バージョン更新で行う
- すべての plan.md は Constitution Check で本原則への準拠を確認する。違反が必要な場合は Complexity Tracking に理由を記録する
- 機能番号（001, 002, ...）は欠番にせず再採番しない

**Version**: 1.1.0 | **Ratified**: 2026-06-10 | **Last Amended**: 2026-09-14
