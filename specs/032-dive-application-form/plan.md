# Implementation Plan: ダイビング申し込みシートのテキスト出力

**Branch**: `worktree-032-dive-application-form` | **Date**: 2026-07-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/032-dive-application-form/spec.md`

## Summary

ショップから依頼される定型の申し込み記入文（お名前（ ）・年齢（ 歳）…）を、フォーム入力からプレーンテキストとして生成しワンタップでコピーできる認証必須ページ `/application-sheet` を service-front に追加する。プロフィール（氏名・生年月日・性別・身長・体重）・保有資格（ランク）・ダイブログ（経験本数・最終ダイブ年月）を自動入力し、アプリが持たない個人属性（携帯電話・緊急連絡先・最寄りの駅・足のサイズ・コンタクト情報・各種経験）は新テーブル `application_profiles` に明示保存して次回復元する。テキスト整形は純関数 `buildSheetText` に分離してテストで出力契約を担保し、導線は TOP ダッシュボードに置く。

## Technical Context

**Language/Version**: TypeScript（strict）/ Next.js 16（App Router）/ React 19 + React Compiler

**Primary Dependencies**: Tailwind CSS・shadcn/ui（`@repo/ui` ラッパー経由）・React Hook Form + yup（プロジェクト標準）。新規依存の追加なし

**Storage**: Supabase（PostgreSQL）。新テーブル `public.application_profiles`（users と 1:1・RLS 本人のみ）を 1 マイグレーションで追加。既存テーブルは参照のみ（[data-model.md](./data-model.md)）

**Testing**: Vitest（buildSheetText・コンポーネント・Server Action）+ Storybook（story）+ Playwright + axe-core（a11y）

**Target Platform**: Web（service-front、モバイルファースト。スマホでコピーして LINE / メールに貼る利用が主）

**Project Type**: npm workspaces モノレポ内の Next.js アプリ（`service-front/`）

**Performance Goals**: プリフィルは page.tsx での 1 回のサーバーフェッチ（user_details / certifications / dives 集計 / application_profiles を並列取得）。プレビュー生成は端末内の純関数で即時反映

**Constraints**: WCAG 2.1 AA（label 関連付け・`role="alert"`・`role="status"`・キーボード操作）/ `app → features → shared` の依存方向・feature 間 import 禁止 / Client Component はフォーム範囲に限定 / 個人情報（緊急連絡先等）は RLS で本人のみアクセス

**Scale/Scope**: 1 ページ + TOP 導線 1 箇所 + proxy prefix 追加。新規 feature フォルダ 1 つ（`features/application-sheet/`）・新規テーブル 1 つ・フォーム約 19 項目（レンタル品目 14 種含む）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 判定 | 根拠 |
|---|---|---|
| I. Spec-Driven Development | PASS | spec.md 承認済み（clarify 4 問 + plan 時の事実修正を反映・checklist 16/16）。この plan → tasks の順で進める |
| II. Server Components First | PASS | page.tsx（Server Component）でプリフィルを取得し、`'use client'` は対話が必要なフォーム範囲（`ApplicationSheetForm` 配下）に限定。`generatePageMetadata` で metadata をエクスポート（noIndex） |
| III. Test-First（テスト同梱） | PASS | `buildSheetText` は出力契約に対する単体テストを先に書く。新規コンポーネントは Vitest + Storybook 同梱、a11y は Playwright + axe を追加 |
| IV. Security & RLS by Default | PASS | `application_profiles` は RLS 有効 + `(select auth.uid()) = user_id` ポリシー（select/insert/update）。マイグレーションファイル経由のみ。Server Action で yup 再バリデーション |
| V. Accessibility（WCAG 2.1 AA） | PASS | 全項目 label 関連付け・エラー `role="alert"`・コピー完了 `role="status"`・ネイティブのラジオ / チェックボックスでキーボード操作可能（[contracts](./contracts/application-sheet-page.md) に明記） |
| VI. Coding Standards | PASS | コンポーネント / lib のフォルダ 3 点構成（`rules/folder-structure.md`）・RHF は `Controller` 経由（`rules/react.md`）・snake_case / CHECK 制約 / timestamptz（`rules/sql.md`） |

**Post-Design Re-check（Phase 1 完了後）**: 逸脱なし。Complexity Tracking への記載事項なし。

## Project Structure

### Documentation (this feature)

```text
specs/032-dive-application-form/
├── spec.md              # 承認済み仕様（clarify 4 問反映）
├── plan.md              # This file
├── research.md          # Phase 0 output（自動入力ソース・保存先・生成方式の決定）
├── data-model.md        # Phase 1 output（application_profiles テーブル定義）
├── quickstart.md        # Phase 1 output（検証手順）
├── contracts/
│   └── application-sheet-page.md  # ページ / サーバー / 出力テキストの契約
└── tasks.md             # Phase 2 output（/speckit-tasks で生成）
```

### Source Code (repository root)

```text
service-front/src/
├── app/
│   ├── (authenticated)/
│   │   └── application-sheet/
│   │       └── page.tsx                     # プリフィル取得 + フォームへ受け渡し（Server Component）
│   └── page.tsx                             # TOP ダッシュボードに導線セクションを追加
├── features/
│   └── application-sheet/                   # 新規 feature
│       ├── constants.ts                     # PAGE_DATA + RENTAL_ITEMS（品目 14 種）+ 出力テンプレート定義
│       ├── types.ts                         # SheetFormValues / SheetPrefill 型
│       ├── index.ts                         # 公開 API
│       ├── schemas/
│       │   └── application-sheet.schema.ts  # yup スキーマ（フォーム + Server Action 共用）
│       ├── lib/
│       │   ├── buildSheetText/              # フォーム値 → 定型テキスト（純関数・テスト重点）
│       │   └── toSheetDefaultValues/        # プリフィル + 保存値 → フォーム初期値（純関数）
│       ├── server/
│       │   ├── queries.ts                   # getApplicationSheetPrefill
│       │   └── actions.ts                   # saveApplicationProfile（upsert）
│       └── components/client/
│           ├── ApplicationSheetForm/        # フォーム統括（RHF + yup・プレビュー・保存）
│           ├── RentalItemsField/            # レンタル有無 + 品目選択 + 省略トグル
│           └── SheetPreview/                # 全文表示（readonly）+ コピー + role="status"
├── proxy.ts                                 # APP_ROUTE_PREFIXES に '/application-sheet' を追加
└── tests/a11y/
    └── application-sheet.spec.ts            # Playwright + axe の a11y テスト

supabase/migrations/
└── <timestamp>_create_application_profiles.sql  # 新テーブル + RLS + トリガ + comment
```

**Structure Decision**: 認証必須ページの確立済みパターン（`(authenticated)` ルートグループ + `proxy.ts` prefix）に従う。プリフィルで他 feature のデータ（user_details / certifications / dives）が必要になるが、feature 間 import を避けるため **application-sheet 自身の `server/queries.ts` で Supabase を直接参照する**（dashboard の `getPrimaryRegulatorStatus` 等と同じ、feature 内で自テーブル外を読むクエリの確立済みパターン）。TOP 導線は 030 `GuideIntroSection` と同様に app 層で組み立てる。

## 実装上の注意（リスク）

- **出力契約が正**: `buildSheetText` のテストは [contracts/application-sheet-page.md](./contracts/application-sheet-page.md) の出力テキスト契約を期待値として書く。テンプレート・品目の追加変更は contracts 更新とセットで行う
- **個人情報の扱い**: 緊急連絡先・電話は保存前に yup で形式チェックし、ログ出力（console.error 等）に値を含めない
- **経験本数の意味**: 自動入力値はアプリ記録分のみ。ユーザー上書きを前提とし、保存はしない（出力にのみ反映）

## Complexity Tracking

> Constitution Check に違反なし。記載事項なし。
