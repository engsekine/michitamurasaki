# Implementation Plan: デイリーボーナス獲得モーダル

**Branch**: `036-daily-bonus-modal` | **Date**: 2026-07-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/036-daily-bonus-modal/spec.md`

## Summary

デイリーボーナス（026）の付与をユーザーに可視化する。`grant_daily_bonus()` RPC の返り値を `void` → `boolean`（付与発生の有無）に変更するマイグレーションを追加し、authenticated layout が `true` を受け取った訪問でのみ、残枠数付きの獲得モーダル（`DailyBonusModal`・既存 Dialog ラッパー使用）を表示する。ハードリロード・同日再訪問は RPC が `false` を返すため再表示されない。既存 E2E の安定性維持のため、シードで既存テストユーザーに当日分を事前付与し、モーダル検証専用ユーザー `bonus@example.com` を新設する。

## Technical Context

**Language/Version**: TypeScript（strict mode）/ Node.js 24 / PostgreSQL（Supabase）

**Primary Dependencies**: Next.js（App Router）・React・Tailwind CSS・既存 `Dialog` ラッパー（`@/shared/components/ui/Dialog`）。新規依存なし

**Storage**: PostgreSQL（Supabase）。テーブル変更なし。関数 `grant_daily_bonus()` の返り値変更マイグレーション 1 本 + シード更新

**Testing**: Vitest（DB 統合 = 既存 creditRules パターン + コンポーネント単体）・Storybook・Playwright + axe-core

**Target Platform**: Web（service-front のみ）

**Project Type**: Web application（モノレポ内 service-front ワークスペース + supabase マイグレーション）

**Performance Goals**: 通常アクセス（付与なし）のレイテンシ増ゼロ（残枠取得は付与発生時のみ）。レイアウトの表示ブロッキングなし（SC-004）

**Constraints**: 付与ルール（1 日 1 枠・JST 暦日・冪等・並行安全）は 026 のまま不変（FR-007）。付与失敗時は従来どおりサイレント（FR-005）。RPC 返り値変更は既存呼び出し（結果を無視している）と後方互換

**Scale/Scope**: マイグレーション 1 本・シード更新・新規コンポーネント 1 式・layout 変更・E2E 1 ファイル

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 判定 | 根拠 |
|------|------|------|
| I. Spec-Driven Development | PASS | spec 036 承認済み。plan → tasks → 実装の順で進める |
| II. Server Components First | PASS | 新規クライアント境界は `DailyBonusModal`（開閉状態のみ）1 点。付与検知・残枠取得は layout（Server Component）で行い、モーダルには props で渡す |
| III. Test-First | PASS | DB 統合（返り値）→ コンポーネント単体 → E2E の 3 層（research.md R5）。いずれもテストを先に書く |
| IV. Security & RLS by Default | PASS | スキーマ変更はマイグレーション経由のみ。関数作り直し時に `security definer` + `set search_path = ''` + `revoke all` / `grant execute to authenticated` を維持（rules/sql.md） |
| V. Accessibility（WCAG 2.1 AA） | PASS | 既存 Dialog ラッパー（role="dialog" / aria-modal / フォーカストラップ / Esc）を使用。axe で検証（SC-003） |
| VI. Coding Standards | PASS | コンポーネントフォルダ規約・named export・マイグレーション命名（`alter_...`）・snake_case に従う |

**Post-Design Re-check（Phase 1 完了後）**: 違反なし。Complexity Tracking への記載事項なし。

## Project Structure

### Documentation (this feature)

```text
specs/036-daily-bonus-modal/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output（関数変更 + シード）
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── daily-bonus-modal.md  # RPC + UI コンポーネント契約
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output（/speckit-tasks）
```

### Source Code (repository root)

```text
supabase/
├── migrations/
│   └── 20260717XXXXXX_alter_grant_daily_bonus_return_granted.sql  # 新規: 返り値 void → boolean
└── seed.sql.template                                              # 変更: 既存 4 ユーザーへ当日分事前付与 + bonus@example.com 新設

packages/
└── supabase/src/types.ts                # 変更: grant_daily_bonus の Returns を boolean に

service-front/
├── src/
│   ├── app/(authenticated)/layout.tsx   # 変更: granted 受け取り → 残枠取得 → モーダル描画
│   └── features/credits/
│       ├── components/client/
│       │   └── DailyBonusModal/         # 新規
│       │       ├── DailyBonusModal.tsx
│       │       ├── DailyBonusModal.test.tsx
│       │       ├── DailyBonusModal.stories.tsx
│       │       └── index.ts
│       └── server/
│           └── creditRules.test.ts      # 変更: 返り値（true/false）の DB 統合テスト追加
└── tests/
    └── daily-bonus-modal.spec.ts        # 新規: E2E（bonus@example.com で表示 → 閉じる → 再表示なし + axe）
```

**Structure Decision**: モーダルは credits 機能固有 UI のため `features/credits/components/client/` に配置（feature-based）。付与検知は既存の layout の RPC 呼び出し箇所をそのまま拡張し、新しい仕組み（Cookie・グローバル状態・Provider）は導入しない。

## 設計詳細

### RPC 契約の変更（マイグレーション）

[contracts/daily-bonus-modal.md](./contracts/daily-bonus-modal.md) を参照。要点:

- `drop function public.grant_daily_bonus();` → `create function public.grant_daily_bonus() returns boolean`（`create or replace` は返り値型の変更が不可のため作り直し）
- 付与成功 → `return true` / `unique_violation`（当日分付与済み）→ `return false`
- `security definer` / `set search_path = ''` / `revoke all from public` / `grant execute to authenticated` を再設定
- `packages/supabase/src/types.ts` の `grant_daily_bonus: { Args: never; Returns: undefined }` → `Returns: boolean`

### 表示フロー

```text
(authenticated)/layout.tsx（Server Component）
 └─ const { data: granted, error } = await supabase.rpc('grant_daily_bonus')
     ├─ error            → console.error のみ（従来どおり。モーダルなし / FR-005）
     ├─ granted !== true → children のみ（従来どおり）
     └─ granted === true → 残枠数を getCreditBalance() で取得（失敗時は null で続行）
                           <DailyBonusModal remainingCredits={remaining} /> + children
```

- クライアントナビゲーションでは layout が再実行されないため、モーダルを閉じた後の遷移で再描画されない。ハードリロードは RPC が `false` → 非表示（FR-003 / SC-002）
- 残枠取得に失敗した場合もモーダル自体は表示し、枠数表示のみ省略する（表示の根拠は「付与の事実」であり残枠は補助情報のため。SC-004 のブロッキング回避）

### シード更新（research.md R4）

| ユーザー | 当日分 daily_bonus 事前付与 | 用途 |
|---|---|---|
| `test@example.com` / `buddy@` / `rename@` / `admin@` | あり（seed で付与） | 既存 E2E がモーダルの影響を受けない |
| `bonus@example.com`（新設・handle: `bonus-hanako`） | なし | モーダル表示の E2E 専用（初回ログインで表示） |

### 主要な技術決定（research.md より）

| # | 決定 | 参照 |
|---|------|------|
| R1 | RPC 返り値を boolean 化（付与検知は DB 層で保証） | [research.md#R1](./research.md) |
| R2 | layout で granted のときのみモーダル描画（追加の状態管理なし） | [research.md#R2](./research.md) |
| R3 | 既存 Dialog ラッパーで実装（a11y を既存資産で担保） | [research.md#R3](./research.md) |
| R4 | シードで既存ユーザー事前付与 + 専用ユーザー新設（E2E 安定化） | [research.md#R4](./research.md) |
| R5 | DB 統合 / 単体 / E2E の 3 層テスト | [research.md#R5](./research.md) |

## Complexity Tracking

Constitution Check に違反なし。記載事項なし。
