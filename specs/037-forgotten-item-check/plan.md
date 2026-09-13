# Implementation Plan: 忘れ物確認機能

**Branch**: `037-forgotten-item-check` | **Date**: 2026-08-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/037-forgotten-item-check/spec.md`

## Summary

予定の持ち物リストに「準備完了」操作を追加し、完了中は持ち物リストの代わりに忘れ物確認リスト（全項目を未確認から確認し直す 2 周目チェック）を表示する。完了状態は `dive_plans` に、確認状態は `plan_packing_items` に持たせ、既存の準備チェック（`is_checked`）とは独立に管理する。UI は持ち物リストが表示される 2 箇所（予定詳細・TOP の予定カード）で、完了状態に応じて `PackingChecklist` / `PackingList` と新規の忘れ物確認リストを出し分ける。

## Technical Context

**Language/Version**: TypeScript（strict mode）/ Node 24

**Primary Dependencies**: Next.js（App Router・React Compiler）/ React 19 / Tailwind CSS / Supabase JS

**Storage**: Supabase（PostgreSQL）。`dive_plans` に完了日時カラム、`plan_packing_items` に確認フラグカラムを追加（マイグレーション経由）

**Testing**: Vitest（単体）/ Storybook（story + addon-a11y）/ Playwright（E2E）

**Target Platform**: Web（service-front のみ。mobile は対象外 — spec Assumptions）

**Project Type**: Web application（モノレポ内 service-front ワークスペース）

**Performance Goals**: 完了操作 → 忘れ物確認リスト表示まで 1 操作（SC-001）。既存の予定取得クエリに JOIN 済みの `plan_packing_items` を使うため追加ラウンドトリップなし

**Constraints**: 準備チェック（`is_checked`）の既存仕様・データは変更しない（spec Assumptions）。完了解除で確認状態は破棄（FR-005）

**Scale/Scope**: 既存の予定・持ち物データ規模のまま（1 予定あたり持ち物 ~20 件想定）。画面追加なし・既存 2 画面の拡張

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 判定 | 根拠 |
|---|---|---|
| I. Spec-Driven Development | PASS | spec.md 確定済み（/speckit-clarify 3 問回答済み）。本 plan → tasks → 実装の順で進める |
| II. Server Components First | PASS | データ取得は既存の Server Components / queries を拡張。クライアント化するのは確認チェック操作・完了/解除ボタンの最小範囲のみ |
| III. Test-First | PASS | 新規コンポーネントは `/generate-with-tests` で Vitest + Storybook + a11y を同梱。server actions はテストを先に書く |
| IV. Security & RLS by Default | PASS | 既存テーブルへのカラム追加のみ。既存 RLS（本人のみ CRUD）がそのまま適用される。マイグレーション SQL 経由 |
| V. Accessibility | PASS | 忘れ物確認リストはチェックボックス + label 関連付け、進捗は role="progressbar"、完了通知は role="status" を使用 |
| VI. Coding Standards | PASS | フォルダ構成規約（専用フォルダ + index.ts）、TypeScript strict、Tailwind utility-first に従う |

違反なし。Complexity Tracking は不要。

**Post-Design Re-check（Phase 1 完了後）**: 設計はカラム追加 2 つ + server actions 3 つ + クライアントコンポーネント 1 つの最小構成で、上記判定に変更なし。PASS。

## Project Structure

### Documentation (this feature)

```text
specs/037-forgotten-item-check/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── server-actions.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
supabase/
└── migrations/
    └── <timestamp>_add_packing_completion.sql   # dive_plans.packing_completed_at / plan_packing_items.is_confirmed

service-front/src/features/plans/
├── components/
│   └── client/
│       ├── PackingChecklist/                    # 既存: 完了ボタンの追加（TOP カード用）
│       ├── PackingList/                         # 既存: 完了ボタンの追加（予定詳細用）
│       └── ForgottenItemChecklist/              # 新規: 忘れ物確認リスト（2 周目チェック + 解除）
│           ├── ForgottenItemChecklist.tsx
│           ├── ForgottenItemChecklist.test.tsx
│           ├── ForgottenItemChecklist.stories.tsx
│           └── index.ts
├── components/server/NextPlanCard/              # 既存: 完了状態でチェックリストを出し分け
├── server/
│   ├── actions.ts                               # completePacking / uncompletePacking / toggleConfirmItem を追加
│   └── queries.ts                               # packingCompletedAt / isConfirmed を select に追加
└── types.ts                                     # PackingItem.isConfirmed / NextPlanSummary.packingCompletedAt 等

service-front/src/app/(authenticated)/plans/[id]/page.tsx   # 予定詳細: 完了状態で表示切替
packages/supabase/src/types.ts                              # DB 型の再生成
```

**Structure Decision**: 既存の Feature-based 構成（`features/plans`）の拡張のみで完結する。新規ルート・新規 feature は作らない。DB は既存 2 テーブルへのカラム追加で、新テーブルは作らない（research.md の Decision 1 参照）。

## Complexity Tracking

違反なし（Constitution Check 全項目 PASS のため本セクションは対象外）。
