# Implementation Plan: 運営管理画面（admin-front）

**Branch**: `015-admin-panel` | **Date**: 2026-06-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-admin-panel/spec.md`

## Summary

利用者向けアプリ（service-front）とは独立した運営者専用の管理画面 **admin-front** を、モノレポの兄弟 Next.js アプリ（別ポート / 別 URL）として新設する。データソースは service-front と**同一の Supabase プロジェクト**を共有する。WordPress 管理画面に倣い「左サイドバー → 一覧テーブル → 詳細・編集フォーム」の操作モデルで、主要ドメイン（ユーザー / ダイブログ / ダイブサイト）は用途特化画面、それ以外は汎用テーブルエディタで管理する。

`/speckit-plan` 時点で確定した方針（spec の NEEDS CLARIFICATION 解決）:

- **管理者識別（FR-005）**: 利用者プロフィール（`public.users`）とは分離した専用テーブル `public.admin_users` で管理者を識別する。認証は同一 Supabase Auth（`auth.users`）を利用するが、admin-front は service-front と**別の認証 Cookie 名**を用いてセッションを完全分離する。
- **アクセス権限（Constitution IV）**: service role でのバイパスは採らず、`public.is_admin()` を判定基準とする **admin 専用 RLS ポリシー**を各管理対象テーブルに追加する。RLS を防御層として維持する。
- **管理スコープ（FR-017）**: 主要エンティティは用途特化画面、残りは汎用テーブルエディタの**併用**。
- **削除方針・監査（FR-018 / US5）**: 原則**ソフトデリート（論理削除 / `deleted_at`）**。全データ変更を **`admin_audit_logs`** に記録（実行者・対象・操作種別・日時）し、操作ログを必須とする。spec FR-013 の「非公開化」は本機能では論理削除を指す（`dives.is_public` の公開可否とは別概念）。

MVP スコープの補足:

- **管理者管理 UI（admin_users の追加/無効化画面）は MVP 外**とし、初期管理者は seed 運用とする（FR-015 の保護ロジックは `admin_users` への全操作経路に適用）。必要になった時点で別機能として画面を追加する。
- **users / user_details は閲覧のみ（編集手段は未提供）**。汎用テーブルエディタは閲覧 + 行削除のみで行編集は未実装（特化画面は閲覧中心。個人情報カラムは許可リストで露出制御）。dive-sites・dives は専用の作成/編集フォームを持つ。

> 補足: spec 末尾の「service-front が admin-front に改名された」というリポジトリ状態は本計画時点で解消済み（`service-front` は無傷、`git status` クリーン）。ルート `package.json` の `workspaces` には既に `admin-front` が登録済みで、本機能はそのディレクトリを新規作成する。

## Technical Context

**Language/Version**: TypeScript 5.7（strict） / Node.js 22.12

**Primary Dependencies**: Next.js 16（App Router, React 19, React Compiler）/ Tailwind CSS 4 / React Hook Form 7 + yup / `@repo/supabase`（`@supabase/ssr`）/ `@repo/ui` / Zustand（必要時）/ lucide-react

**Storage**: Supabase（PostgreSQL + Auth + RLS）— service-front と同一プロジェクトを共有

**Testing**: Vitest（単体）/ Storybook（`@storybook/addon-a11y` + `addon-vitest`）/ Playwright + `@axe-core/playwright`（a11y / E2E）

**Target Platform**: Web（モダンブラウザ）。SSR / Server Components 中心

**Project Type**: Web application（モノレポ内の追加 Next.js アプリ `admin-front/`、`service-front/` と兄弟）

**Performance Goals**: 一覧・検索は数万件規模でも体感 2 秒以内（SC-004）。サーバー側ページング + 必要カラムのみ select + 適切なインデックスで担保

**Constraints**: 全ページ・全操作で管理者権限チェック（SC-001、漏れ 0）。破壊的操作は確認 UI 必須（SC-006）。WCAG 2.1 AA（Constitution V）。`any` 禁止・strict（Constitution VI）

**Scale/Scope**: 限られた信頼できる運営者向け。MVP 画面: ログイン / ダッシュボード / ユーザー一覧・詳細 / ダイブログ一覧・詳細・編集 / ダイブサイト CRUD / 汎用テーブルエディタ / 操作ログ一覧（おおむね 8〜10 画面）

## Constitution Check

*GATE: Phase 0 前に通過必須。Phase 1 設計後に再チェック。*

| 原則 | 準拠方針 | 判定 |
|---|---|---|
| I. Spec-Driven（spec-kit が正） | 本 plan / data-model / contracts を確定後に実装。実装とのズレは spec 側を更新 | ✅ |
| II. Server Components First | admin-front も App Router。一覧・詳細は Server Components + queries.ts、mutation は Server Actions。`'use client'` は検索フォーム・確認モーダル等の最小範囲。各 page は `generatePageMetadata` を export（admin 用 metadata 設定を新設、`robots: noindex`） | ✅ |
| III. Test-First | 新規コンポーネントは `/generate-with-tests` で Vitest + Storybook + Playwright a11y を同梱。権限ガード・削除確認・監査記録には回帰テストを追加 | ✅ |
| IV. Security & RLS by Default | service role バイパスを採らず `is_admin()` ベースの admin RLS ポリシーを追加（RLS を防御層として維持）。マイグレーション SQL 経由のみ。関数は `set search_path = ''`。`admin_users` / `admin_audit_logs` も RLS 有効化 | ✅ |
| V. Accessibility（WCAG 2.1 AA） | サイドバー / テーブル / フォーム / モーダルをセマンティック HTML + ARIA で実装。`@/shared/components/form` 相当を admin 側に用意。axe テスト必須 | ✅ |
| VI. Coding Standards（rules/ 準拠） | Feature-based アーキテクチャ（`arch/feature-based.md`）に準拠。snake_case / 3NF / timestamptz（sql.md）。TypeScript strict | ✅ |

**ゲート結果**: 違反なし。Complexity Tracking は不要。

**設計上の注意（Constitution に抵触しないが要明示）**:

- admin-front は全ユーザーデータを横断参照するため RLS を「本人のみ」から「本人 **または** 管理者」に広げる。これは Constitution IV の意図（RLS を効かせたうえで最小権限）に沿うが、`is_admin()` の判定ミスが全データ露出に直結するため、ポリシーと関数のテストを厚くする。
- ソフトデリート（`deleted_at`）導入に伴い、**service-front 側の既存クエリは `deleted_at is null` フィルタを追加**する必要がある（クロスアプリ影響。tasks で明示）。

## Project Structure

### Documentation (this feature)

```text
specs/015-admin-panel/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output（admin Server Actions / queries の契約）
│   ├── admin-auth.md
│   ├── admin-resource.md
│   └── admin-audit.md
└── tasks.md             # Phase 2 output (/speckit-tasks — 本コマンドでは未生成)
```

### Source Code (repository root)

モノレポ構成。`admin-front/` を新規追加し、`service-front/` の Feature-based 構成（`arch/feature-based.md`）をそのまま踏襲する。共有は `packages/` 経由。

```text
admin-front/                      # 新規 Next.js アプリ（別ポート: dev 3001 想定）
├── package.json                  # name: "admin-front"（workspaces 登録済み）
├── next.config.ts / tsconfig.json / vitest.config.ts / playwright.config.ts / biome 等
└── src/
    ├── app/
    │   ├── (auth)/login/page.tsx          # 管理者ログイン
    │   ├── (admin)/                       # 要・管理者権限グループ
    │   │   ├── layout.tsx                 # サイドバー + ヘッダー（WordPress 風シェル）
    │   │   ├── page.tsx                   # ダッシュボード（KPI）
    │   │   ├── users/{page, [id]/page}.tsx
    │   │   ├── dives/{page, [id]/page, [id]/edit/page}.tsx
    │   │   ├── dive-sites/{page, new/page, [id]/edit/page}.tsx
    │   │   ├── tables/[table]/page.tsx    # 汎用テーブルエディタ
    │   │   └── audit-logs/page.tsx        # 操作ログ一覧
    │   ├── api/auth/                       # 必要時（callback 等）
    │   └── proxy.ts                        # 管理者ゲート（middleware 相当）
    ├── features/
    │   ├── admin-auth/        # ログイン・ログアウト・is_admin ゲート
    │   ├── dashboard/         # KPI 集計
    │   ├── users-admin/       # ユーザー一覧・詳細（特化）
    │   ├── dives-admin/       # ダイブログ一覧・詳細・編集（特化）
    │   ├── dive-sites-admin/  # ダイブサイト CRUD（特化マスタ）
    │   ├── table-editor/      # 汎用テーブルエディタ
    │   └── audit-log/         # 操作ログ参照 + 記録ユーティリティ
    ├── shared/
    │   ├── components/layout/ # AdminSidebar / AdminHeader / AdminShell
    │   ├── components/table/  # DataTable / Pagination / EmptyState
    │   ├── components/form/   # FormField 等（service-front から共通化検討）
    │   ├── components/feedback/ # Toast / ConfirmDialog（破壊的操作確認）
    │   ├── lib/supabase/      # admin 用 server/browser/middleware ラッパ（別 Cookie 名）
    │   ├── lib/audit/         # 監査ログ記録ヘルパ
    │   └── config/metadata.ts # admin 用 metadata（noindex）
    └── lib/                   # cn 等

packages/
├── supabase/                 # 既存。Cookie 名を引数/環境変数で差し替え可能に変更
│   └── src/{server,browser,middleware,constants}.ts
└── ui/                       # 既存 UI プリミティブ（再利用）

supabase/migrations/          # admin 用マイグレーションを追加（data-model.md 参照）
├── <ts>_create_admin_users.sql
├── <ts>_create_admin_auth_functions.sql  # is_admin() / is_superadmin() + admin_users ポリシー（再帰回避で同居）
├── <ts>_create_admin_audit_logs.sql
├── <ts>_add_soft_delete_columns.sql      # 管理対象テーブルに deleted_at
├── <ts>_add_admin_rls_policies.sql       # 各管理対象テーブルへ admin ポリシー群
└── <ts>_filter_soft_deleted_from_user_reads.sql  # service-front の利用者 read を deleted_at is null に

service-front/                # 既存アプリ（影響: soft-delete フィルタ適用済み）
```

**Structure Decision**: モノレポに **`admin-front/` を新規 Next.js アプリとして追加**（ルート `package.json` の `workspaces` に登録済み）。service-front の Feature-based 構成・コンポーネント規約・データ層規約をそのまま採用し、共有コード（Supabase クライアント / UI プリミティブ）は `packages/` 経由で利用する。Supabase クライアント（`@repo/supabase`）の Cookie 名は現状ハードコード定数のため、admin と service でセッションを分離できるよう**引数 / 環境変数で差し替え可能**に小改修する。

## Complexity Tracking

> Constitution Check に違反がないため記載不要。
