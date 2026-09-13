# Implementation Plan: TOP ページ拡張（ダイビング予定 / 持ち物リスト）

**Branch**: `004-top-dive-plans` | **Date**: 2026-06-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-top-dive-plans/spec.md`

## Summary

認証済みユーザーがダイビング予定（予定日・ポイント・メモ）を CRUD で管理し、予定ごとの持ち物リスト（デフォルト装備の自動展開 + チェック / 追加 / 削除）で準備できる機能。TOP ページ（003-dashboard）には「次の予定」カード（残り日数 + 持ち物進捗）を追加する。データは `dive_plans` / `plan_packing_items` の 2 テーブルに保持し、所有者制限は RLS で保証する。一覧・詳細表示は Server Components、チェック操作・書き込みは Server Actions（`ActionResult<T>` 統一）で行う。

## Technical Context

**Language/Version**: TypeScript（strict mode）/ React 19 / Next.js 16（App Router、React Compiler 有効）

**Primary Dependencies**: React Hook Form + yup（フォーム。`@/shared/components/form` の FormField 系を使用）、Tailwind CSS、`@repo/supabase`（Supabase クライアント）、`@repo/ui`（共通 UI）。TanStack Query は本 feature では不要（一覧は件数が少なくページネーション不要のため Server Components のみ）

**Storage**: Supabase（PostgreSQL）。`public.dive_plans` + `public.plan_packing_items`（新規）。スキーマはマイグレーション SQL 管理（[data-model.md](data-model.md) 参照）

**Testing**: Vitest（スキーマ・lib・コンポーネント単体 / Storybook テスト）、Playwright（E2E・a11y）

**Target Platform**: Web（モバイル / タブレット / PC、モバイルファースト）

**Project Type**: Web アプリケーション（モノレポ内 `service-front`）

**Performance Goals**: 予定はユーザーあたり高々数十件想定のためページネーション不要（全件取得）。持ち物チェックは操作後 1 秒以内に永続化完了

**Constraints**: WCAG 2.1 AA 準拠 / RLS 必須 / `user_id` は Server Action 側で `auth.uid()` から強制セット / Server Actions の戻り値は `ActionResult<T>`（`arch/feature-based.md` のデータ層規約）

**Scale/Scope**: 画面 3 つ（予定一覧 / 予定作成・編集 / 予定詳細 = 持ち物リスト）+ TOP への 1 セクション追加。新規テーブル 2 つ

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` v1.0.0 に照らして確認:

| 原則 | 判定 | 根拠 |
|---|---|---|
| I. Spec-Driven | ✅ | spec.md 確定済み（checklists/requirements.md 全項目パス） |
| II. Server Components First | ✅ | 一覧・詳細は Server Components。Client はフォーム / チェック操作 / 削除ボタンのみ |
| III. Test-First | ✅ | スキーマ・lib・コンポーネントに Vitest + Storybook + Playwright a11y を同梱（テスト方針節参照） |
| IV. Security & RLS | ✅ | 新規 2 テーブルとも RLS 有効化 + `(select auth.uid())` ポリシー（data-model.md） |
| V. Accessibility | ✅ | FormField 系共通コンポーネント使用、チェックリストは native checkbox + label（a11y 節参照） |
| VI. Coding Standards | ✅ | `arch/feature-based.md` の構成・データ層規約（ActionResult / 生成型 Database / toNumber）に準拠 |

**Post-Design 再評価（Phase 1 完了後）**: 違反なし。

## Project Structure

### Documentation (this feature)

```text
specs/004-top-dive-plans/
├── spec.md              # 機能仕様
├── plan.md              # This file
├── research.md          # Phase 0: 設計判断の記録
├── data-model.md        # dive_plans / plan_packing_items 定義
├── quickstart.md        # 検証手順
├── checklists/
│   └── requirements.md  # 仕様品質チェックリスト
└── tasks.md             # Phase 2: /speckit-tasks で生成
```

### Source Code (repository root)

```text
supabase/
└── migrations/
    └── <ts>_create_dive_plans.sql        # dive_plans + plan_packing_items（強依存のため 1 ファイル）

service-front/src/
├── app/(authenticated)/
│   ├── page.tsx                          # TOP（003 実装に NextPlanCard を追加）
│   └── plans/
│       ├── page.tsx                      # 予定一覧
│       ├── new/page.tsx                  # 予定作成
│       └── [id]/
│           ├── page.tsx                  # 予定詳細（持ち物リスト）
│           └── edit/page.tsx             # 予定編集
└── features/plans/
    ├── index.ts                          # 公開 API
    ├── components/
    │   ├── client/
    │   │   ├── PlanForm/                 # 作成・編集共有フォーム（FormField 使用）
    │   │   ├── PlanList/                 # 予定一覧（未来 / 終了済みの区分表示）
    │   │   ├── PackingList/              # 持ち物チェックリスト（toggle / 追加 / 削除）
    │   │   ├── PackingChecklist/         # TOP カード用の持ち物チェックリスト（toggle のみ。feat/design-change で追加）
    │   │   └── DeletePlanButton/
    │   └── server/
    │       └── NextPlanCard/             # TOP 用「次の予定」カード（NextPlanCardView。データはページ側から注入）
    ├── schemas/plan.schema.ts            # yup（planSchema / packingItemSchema）
    ├── server/
    │   ├── actions.ts                    # createPlan / updatePlan / deletePlan /
    │   │                                 #   togglePackingItem / addPackingItem / deletePackingItem
    │   └── queries.ts                    # listPlans / getPlan / listNextPlansWithProgress（旧 getNextPlanWithProgress）
    ├── lib/
    │   ├── days-until.ts                 # 残り日数計算（todayInJst 基準）
    │   └── default-packing-items.ts      # デフォルト持ち物定義
    ├── constants.ts
    └── types.ts
```

**Structure Decision**: 既存 feature（dives / auth / account）と同一の Feature-based 構成。コンポーネントは 1 コンポーネント 1 フォルダ（test / story 同梱）。

## 設計詳細

### ルーティングと認証

- `/plans` 配下はすべて要認証。`src/proxy.ts` の `APP_ROUTE_PREFIXES` に `/plans` を追加し、未認証は `/login` へリダイレクト（FR-016）
- 画面遷移: 一覧 → 作成 / 詳細、詳細（持ち物）→ 編集。削除は一覧・詳細の双方から確認ダイアログ付きで実行

### データフロー

- **読み取り**: Server Components から `server/queries.ts`（`listPlans` / `getPlan`）。エラーは throw して `error.tsx` に委ねる。`getPlan` のデータなし（RLS 含む）は null → `notFound()`
- **書き込み**: Server Actions（`ActionResult<T>` 戻り値、`actionSuccess` / `actionFailure` 使用）。`user_id` はサーバー側で `auth.getUser()` から設定
- **持ち物チェック**: `PackingList`（Client Component）から `togglePackingItem` を `useTransition` で呼び、成功時に `router.refresh()`。楽観更新は Phase 1 では行わない（操作対象が小さく往復も軽量なため）

### デフォルト持ち物の展開（FR-011）

`createPlan` Server Action 内で、予定 insert 成功後に `lib/default-packing-items.ts` の定義（12 項目: マスク / シュノーケル / フィン / ブーツ / ウェットスーツ / レギュレーター / BCD / ダイブコンピューター / ログブック / Cカード / タオル / 日焼け止め）を `plan_packing_items` に一括 insert する。DB 側にテンプレートテーブルは持たない（[research.md](research.md) の Decision 2）。

### 残り日数計算（FR-007）

`lib/days-until.ts` の純粋関数で `todayInJst()`（`@/shared/lib/date`）と `planned_on` の日数差を計算。当日は 0（「今日」表示）、未来は正の値（「あと N 日」）。テスト容易性のため「今日」を引数で受ける設計にする。

### TOP への統合（FR-006〜009）

- `page.tsx`（app 層）が `listNextPlansWithProgress(3)` で「近い順の予定 + 持ち物全件」を取得し、FV（`DashboardHero`・先頭 1 件）と本文の詳細カード（`NextPlanCardView`・最大 3 件）に注入して表示（feat/design-change で 1 件 → 最大 3 件 + カード上チェック操作に拡張。自己フェッチの `NextPlanCard` ラッパーは削除）
- `NextPlanCardView` は props 駆動のため独立してテスト可能（Storybook / 単体テスト）
- 同日複数予定は作成日時が新しい順（spec の Edge Case）

### エラーハンドリング

- RLS 違反 / 存在しない id → `notFound()` で 404
- バリデーションエラー → フォームにフィールド単位で表示（FormField の error 表示）
- Server Actions 失敗 → `ActionResult` の error をフォーム上部 / リスト近傍に `role="alert"` で表示
- SSR データ取得の Supabase エラー → throw して `error.tsx`

### アクセシビリティ

- フォームは `@/shared/components/form`（FormField / FormTextarea）を使用（label 関連付け・エラー aria は共通実装が担保）
- 持ち物リストは `<ul>` + native `<input type="checkbox">` + `<label>`。チェック状態変更は `aria-live="polite"` の進捗テキスト（「3 / 12 準備済み」）に反映
- 残り日数・終了済みバッジは色だけに依存せずテキストで表現
- 削除確認ダイアログはフォーカストラップ + Esc 対応（既存 DeleteDiveButton と同実装パターン）

### テスト方針

| 対象 | テスト |
|---|---|
| `plan.schema.ts` | Vitest（必須 / 日付形式 / 文字数上限） |
| `lib/days-until.ts` / `default-packing-items.ts` | Vitest（境界値: 今日 / 過去 / 未来） |
| 各 Client Component | Vitest + Storybook（`/generate-with-tests` で生成） |
| `NextPlanCard` | Storybook（予定あり / なし / 今日 / 準備完了の 4 状態） |
| 画面フロー | Playwright a11y（axe、`/plans` 系 3 画面） |

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

違反なし（記載事項なし）。
