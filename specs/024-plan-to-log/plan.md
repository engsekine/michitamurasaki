# Implementation Plan: ダイビング予定をログへ移動

**Branch**: `024-plan-to-log` | **Date**: 2026-07-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/024-plan-to-log/spec.md`

## Summary

当日以前のダイビング予定（`dive_plans`）を、手入力し直すことなく新規ダイビングログ（`dives`）へ「移動」できるようにする。予定一覧・予定詳細に「ログに記録する」導線（当日以前の予定のみ・未来日は非表示）を追加し、`/dives/new?fromPlanId=<id>` へ遷移させる。新規ログ作成ページはこのクエリを受けて予定を取得し、**予定日→潜水日・ポイント名→ポイント名・メモ→メモ**を初期値として `DiveForm` にプレフィルする。フォーム送信は新設の Server Action `createDiveFromPlan(planId, input)` を通じ、(1) 予定の存在・所有を確認（重複作成防止 / FR-015）、(2) 既存 `createDive` を再利用してログを作成、(3) 成功時のみ予定を削除（持ち物は FK cascade で連動削除 / FR-011）する。ログ作成失敗時は予定を残し（FR-010）、予定削除だけ失敗した場合はログを保持して警告通知する（FR-011a）。**DB スキーマ変更は不要**——既存 `dives` への insert と `dive_plans` の delete を組み合わせるだけで、既存の RLS がそのまま適用される。

## Technical Context

**Language/Version**: TypeScript（strict）/ Next.js App Router / React（React Compiler）

**Primary Dependencies**: 既存のみ。Supabase（Auth + PostgreSQL + RLS）、React Hook Form、yup、Tailwind。既存資産を再利用: `DiveForm`（002）/ `createDive`（002）/ `deletePlan`・`getPlan`（004）/ `daysUntil`・`todayInJst`（shared/lib/date）

**Storage**: Supabase（PostgreSQL）。**マイグレーション無し**。書き込み対象は既存 `public.dives`（insert）と `public.dive_plans`（delete）、`public.plan_packing_items` は予定削除に伴う `on delete cascade` で連動削除

**Testing**: Vitest（`createDiveFromPlan` Server Action・prefill mapper・move 可否判定 helper・`useDiveFormSubmit` 分岐）、Storybook（`DiveForm` の fromPlan 初期値 story・予定カードの導線）、Playwright（予定→ログ移動の E2E + axe-core a11y）

**Target Platform**: Web（service-front）

**Project Type**: Web application（service-front）。Supabase マイグレーションは伴わない

**Performance Goals**: 特別な要件なし（既存の単一 insert / delete の範囲）

**Constraints**: 移動可否は JST の「今日」基準で `daysUntil(plannedOn, todayInJst()) <= 0`（当日以前）。ログの潜水日は未来日を受け付けない既存仕様に整合。ログ作成と予定削除は非原子（別操作）——ログを真実として扱い、削除失敗は通知で補う（2026-07-01 clarify 済み）。ポイント名（両者 120 文字）・メモ（両者 2000 文字）は上限が一致するため引き継ぎで切り詰めは発生しない

**Scale/Scope**: 新規 Server Action 1（`createDiveFromPlan`）、新規 pure helper 2（`planToDiveDefaults` / `canMovePlanToLog`）、変更ファイル: `/dives/new/page.tsx`（searchParams 受理）・`DiveForm`（`fromPlanId` prop）・`useDiveFormSubmit`（分岐 + 警告）・`PlanList`（導線）・`/plans/[id]/page.tsx`（導線）。対象外: 予定の複数一括移動、移動履歴の保持、持ち物→ログへの引き継ぎ、未来日予定の移動、DB スキーマ変更

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 準拠状況 |
|------|---------|
| I. Spec-Driven Development | spec → clarify → plan の順で確定済み。違反なし |
| II. Server Components First | 予定取得・プレフィルは Server Component（`/dives/new/page.tsx`）。移動確定は Server Action `createDiveFromPlan`。Client は既存 `DiveForm` / `useDiveFormSubmit` の最小インタラクションのみ。違反なし |
| III. Test-First | 新規 Server Action・helper は Vitest、`DiveForm` 変更は Storybook + Vitest 同期、移動 E2E は Playwright + axe-core。変更コンポーネントは同階層テスト/story を同期更新。違反なし |
| IV. Security & RLS by Default | 既存 `dives`（本人のみ insert）と `dive_plans`（本人のみ select/delete）の RLS がそのまま適用。新規テーブル/ポリシー無し。`createDiveFromPlan` は `auth.getUser()` で本人確認し、予定の所有チェックを追加。違反なし |
| V. Accessibility（WCAG 2.1 AA） | 「ログに記録する」は `Link`（`buttonVariants`）でキーボード操作可・44px 相当。予定日を含むアクセシブルな導線ラベル。警告通知は `role="status"`/`alert` 相当で通知。違反なし |
| VI. Coding Standards | TypeScript strict / Feature-based（plans→dives の直交ワークフロー依存）/ Tailwind / 早期リターン。DB は既存構造を踏襲（3NF・cascade）。違反なし |

**判定**: 違反なし。Complexity Tracking 記載不要。

## Project Structure

### Documentation (this feature)

```text
specs/024-plan-to-log/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0: 設計判断（オーケストレーション / 導線ゲート / 部分失敗）
├── data-model.md        # Phase 1: スキーマ変更なしの明示 + 読み書きタッチポイント
├── quickstart.md        # Phase 1: 移動フローの検証手順
├── contracts/
│   ├── server-actions.md   # createDiveFromPlan の入出力契約
│   └── ui-and-forms.md     # 導線ゲート・prefill マッピング・DiveForm fromPlanId
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks 出力（本コマンドでは未生成）
```

### Source Code (repository root)

```text
service-front/src/
├── app/(authenticated)/
│   ├── dives/new/page.tsx              # ★変更: searchParams.fromPlanId を受理し予定を取得・prefill
│   └── plans/[id]/page.tsx             # ★変更: remaining<=0 の予定に「ログに記録する」導線を追加
├── features/dives/
│   ├── server/actions.ts               # ★変更: createDiveFromPlan を追加（createDive を再利用 + 予定削除）
│   ├── lib/
│   │   └── planToDiveDefaults/         # ★新規: 予定→DiveForm 初期値 の pure mapper（+ test/index）
│   ├── components/client/DiveForm/
│   │   ├── DiveForm.tsx                # ★変更: fromPlanId prop を追加し useDiveFormSubmit へ委譲
│   │   ├── DiveForm.stories.tsx        # ★同期: fromPlan 初期値の story
│   │   └── DiveForm.test.tsx           # ★同期
│   └── hooks/
│       ├── useDiveFormSubmit.ts        # ★変更: fromPlanId 分岐（createDiveFromPlan）+ planDeleteFailed 警告
│       └── useDiveFormSubmit.test.ts   # ★同期
└── features/plans/
    ├── lib/
    │   └── canMovePlanToLog/           # ★新規: daysUntil<=0 の移動可否 pure 判定（+ test/index）
    └── components/client/PlanList/
        ├── PlanList.tsx                # ★変更: 対象予定カードに「ログに記録する」導線
        ├── PlanList.stories.tsx        # ★同期
        └── PlanList.test.tsx           # ★同期
```

**Structure Decision**: 既存 Feature-based 構成を踏襲。移動オーケストレーション（`createDiveFromPlan`）は **成果物がログである**ため dives feature に配置し、同一モジュール内の `createDive` を再利用してロジック重複を避ける。`dive_plans` の存在確認・削除は同 Action 内でテーブル操作として行う（plans feature の Action を import せず結合を最小化）。移動可否判定（`canMovePlanToLog`）は導線を持つ plans feature 側の pure helper に置き、一覧・詳細で共有する。予定→初期値の変換（`planToDiveDefaults`）はログ側の入力に責務があるため dives feature の pure helper に置く。

## Phase 0: Research

主要な設計判断は [research.md](research.md) に集約する。要点:

1. **オーケストレーションの置き場所と方式** — client 連続呼び出し（createDive→deletePlan）ではなく、Server Action `createDiveFromPlan` に集約。理由: FR-015（予定が既に無い場合の重複作成防止）を満たすには、ログ作成の**前**に予定の存在・所有を確認する必要があり、サーバー 1 箇所に閉じるのが安全。
2. **移動導線のゲート条件** — `daysUntil(plannedOn, todayInJst()) <= 0`（当日=0 / 過去<0 を許可、未来>0 を除外）。既存 `PlanList` の「終了済み / これから」区分と同じ関数を再利用。
3. **プレフィルのマッピングと切り詰め** — `planned_on→diveDate` / `location→location`（`diveSiteId` は空でマスタ排他を満たす）/ `notes→notes`。上限は両者一致（location 120・notes 2000）のため切り詰め不要。`diveNumber` は既存 new ページの自動採番（最新+1）を維持（FR-013）。
4. **部分失敗（ログ作成後の予定削除失敗）** — ログは保持し、`createDiveFromPlan` が `planDeleteFailed: true` を返す。`useDiveFormSubmit` は既存の `serverWarning` 経路で通知（buddyWarning と同一パターン）。
5. **スキーマ変更が不要な根拠** — 移動は既存 `dives` insert と `dive_plans` delete の合成で完結し、状態カラムや履歴テーブルは持たない（移動＝物理削除の方針）。

## Phase 1: Design & Contracts

- **データモデル**: [data-model.md](data-model.md) — 新規テーブル/カラム無し。`dives`（書込: insert）/ `dive_plans`（書込: delete）/ `plan_packing_items`（cascade delete）の関与と、既存 RLS の適用範囲を明記。
- **契約**:
  - [contracts/server-actions.md](contracts/server-actions.md) — `createDiveFromPlan(planId, input)` の入力・出力（`{ id; buddyWarning?; planDeleteFailed? }`）・失敗系・所有/存在チェック・呼び出し順序。
  - [contracts/ui-and-forms.md](contracts/ui-and-forms.md) — 導線ゲート（`canMovePlanToLog`）・配置（一覧/詳細）・遷移先 `/dives/new?fromPlanId=`・`planToDiveDefaults` マッピング表・`DiveForm` の `fromPlanId` prop・警告 UI。
- **検証手順**: [quickstart.md](quickstart.md) — 当日以前の予定からの移動成功、未来日予定に導線が出ないこと、必須未入力での非作成、部分失敗時のログ保持+通知を手動/自動で確認する手順。
- **Agent context 更新**: `.claude/CLAUDE.md` の `<!-- SPECKIT START -->`〜`<!-- SPECKIT END -->` を本 plan（`specs/024-plan-to-log/plan.md`）へ更新。

**Post-Design Constitution Re-check**: 設計後も新規 RLS・スキーマ・重い Client 化は発生せず、全原則に適合（違反なし）。
