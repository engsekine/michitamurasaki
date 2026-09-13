# Implementation Plan: ダイバー種別・ダイバー番号の登録

**Branch**: `019-diver-type` | **Date**: 2026-06-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/019-diver-type/spec.md`

## Summary

ユーザープロフィールに **ダイバー種別**（インストラクター / 一般ダイバー・登録時必須）と **ダイバー番号**（インストラクターのみ・任意・50 文字以内）を追加する。`user_details` に 2 列 + CHECK（種別 enum / 番号長 / 番号は instructor のみ）を足し、共有スキーマの 2 フィールドセット（`requiredDiverFields` / `optionalDiverFields`）で「登録は必須・編集は任意」を吸収する。番号欄は `diver_type === 'instructor'` のときだけ表示（各フォームで `watch`）。記録は 016/018 と同じく `handle_new_user` トリガー（メール）／`completeProfile`（Google 初回）／`updateProfile`（編集）に組み込む。既存ユーザーは両列 NULL で grandfather。

## Technical Context

**Language/Version**: TypeScript（strict）/ Next.js App Router / React（React Compiler）

**Primary Dependencies**: 既存のみ。React Hook Form（`watch` で条件表示）、yup、Tailwind、`@repo/ui`

**Storage**: Supabase（PostgreSQL）。`public.user_details` に `diver_type text`（null可）/ `diver_number text`（null可）を追加 + CHECK 3 種。`handle_new_user` 再定義。マイグレーション 1 本

**Testing**: Vitest（スキーマ・Server Actions・mapper）、Storybook、Playwright（E2E + axe-core a11y）

**Target Platform**: Web（service-front）

**Project Type**: Web application（service-front + supabase マイグレーション）

**Performance Goals**: 特別な要件なし

**Constraints**: `diver_type` は登録必須・編集任意（共有スキーマをファクトリで分岐）。`diver_number` は instructor 選択時のみ（UI 非表示＋yup `.when` で null 化＋DB CHECK）。トリガーは `security definer set search_path=''` 維持。既存ユーザーは NULL

**Scale/Scope**: 列 2 + CHECK 3、定数 1、共有スキーマ 1（ファクトリ）、3 スキーマ（signup / profile-completion / account）へ組み込み、3 フォームへ条件付き UI、Server Actions 3（signUp / completeProfile / updateProfile）+ mapper 2、DB マイグレーション 1。対象外: 種別による機能分岐

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 準拠状況 |
|------|---------|
| I. Spec-Driven Development | spec → plan → tasks。違反なし |
| II. Server Components First | 記録は Server Action / トリガー。条件表示はインタラクションのため最小 Client（既存フォーム内）。違反なし |
| III. Test-First | スキーマ（ファクトリ）・Actions・mapper は Vitest。UI 変更分のテストも同梱。違反なし |
| IV. Security & RLS by Default | 既存 `user_details` の RLS が新列もカバー（新規不要）。トリガー search_path 固定維持。CHECK で整合担保。違反なし |
| V. Accessibility（WCAG 2.1 AA） | `FormRadioGroup`（ラベル/`role`）＋条件付き `FormField`。エラー `role="alert"` / `aria-invalid`。違反なし |
| VI. Coding Standards | TypeScript strict / Feature-based / snake_case・text+CHECK（enum 型不使用）/ `react.md`（RHF オブジェクトを子へ渡さない＝インライン watch）。違反なし |

**判定**: 違反なし。Complexity Tracking 記載なし。

## Project Structure

### Documentation (this feature)

```text
specs/019-diver-type/
├── spec.md / plan.md / research.md / data-model.md / quickstart.md
├── contracts/
│   ├── forms.md          # diver-type 定数・required/optionalDiverFields・条件付き UI・各フォーム組み込み
│   └── server-actions.md # signUp / completeProfile / updateProfile と mapper
└── tasks.md              # /speckit-tasks 出力
```

### Source Code (repository root)

```text
service-front/src/
├── shared/
│   ├── constants/diver-type.ts          # ★新規: DIVER_TYPE_VALUES / OPTIONS / type DiverType
│   └── schemas/diver.ts                  # ★新規: requiredDiverFields / optionalDiverFields（diverType / diverNumber）
├── features/auth/
│   ├── schemas/{signup,profile-completion}.schema.ts # ★変更: ...requiredDiverFields 追加
│   ├── server/actions.ts                 # ★変更: signUp（data に diver_*）/ completeProfile（input 追加）
│   ├── server/mappers/profile-completion.ts # ★変更: diver_type/diver_number を INSERT に
│   └── components/client/{SignupForm,ProfileCompletionForm}/… # ★変更: 種別ラジオ＋条件付き番号欄
└── features/account/
    ├── schemas/profile.schema.ts         # ★変更: ...optionalDiverFields 追加
    ├── server/actions.ts                 # ★変更: UpdateProfileInput に diver_* / getProfile に列追加
    ├── server/mappers/profile.ts         # ★変更: diver_* の双方向マップ
    └── components/client/ProfileEditForm/… # ★変更: 種別ラジオ＋条件付き番号欄

supabase/migrations/
└── 20260629100000_add_diver_type.sql     # ★新規: user_details 2列 + CHECK 3 + handle_new_user 再定義
```

**Structure Decision**: 016/018 と同じ「共有プロフィール属性を `user_details` に追加し、両登録経路＋編集に組み込む」構造。必須差は 2 フィールドセット（`requiredDiverFields` / `optionalDiverFields`）で吸収し、条件付き番号欄は各フォームの `watch` でインライン描画（`react.md` 準拠）。

## 設計の詳細

### データモデル（[data-model.md](data-model.md)）
`user_details` に `diver_type`（null可・`in('instructor','general')`）/ `diver_number`（null可・`<=50`）を追加。CHECK: ①種別 enum ②番号長 ③ **番号は instructor のときのみ非 NULL**。既存行は NULL。

### スキーマ（[contracts/forms.md](contracts/forms.md)）
2 フィールドセット（共通 `diverNumber` を共有）:
- `requiredDiverFields`（signup / profile-completion）: `diverType` 必須
- `optionalDiverFields`（account 編集）: `diverType` 任意（未選択可・既存ユーザー非ブロック、FR-009）
- `diverNumber`: `max(50)` ＋ `.when('diverType', is:'instructor' ? 維持 : strip)`

### UI（条件付き表示）
各フォームで `watch('diverType')`。`'instructor'` のときだけ `diver_number` の `FormField` を表示。一般ダイバーに変更したら番号は送信値から除外（yup `.when`）。

### 記録経路
| 経路 | 主体 | 備考 |
|------|------|------|
| メール登録 | `handle_new_user` トリガー | `options.data` 経由で `diver_type`/`diver_number` を受け取り INSERT（016/018 の分岐内に追記） |
| Google 初回 | `completeProfile` の INSERT | `toUserDetailsInsert` に追加 |
| プロフィール編集 | `updateProfile` の UPDATE | `toUserDetailsUpdate` に追加。一般ダイバー時は番号を NULL に |

### 生成型
`packages/supabase/src/types.ts` の `user_details`（Row/Insert/Update）に 2 列を反映。

### アクセシビリティ
種別は `FormRadioGroup`（凡例・`role`・キーボード）、番号は `FormField`（label/`aria-invalid`/エラー `role="alert"`）。

## Complexity Tracking

違反なしのため記載事項なし。
