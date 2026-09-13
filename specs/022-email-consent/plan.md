# Implementation Plan: メール配信許可（オプトイン）

**Branch**: `022-email-consent` | **Date**: 2026-06-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/022-email-consent/spec.md`

## Summary

新規登録（メール登録 `/signup`・Google 初回 `/profile-completion`）に「お知らせメールを受け取る」任意チェックを追加し、明示的にオンにした場合のみ配信を許可する。登録後は既存の設定画面 `/settings/profile` のトグルでいつでも許可・撤回できる（US2）。同意状態は `user_details` に `is_email_opted_in`（boolean）/ `email_opted_in_at`（timestamptz）として記録し、CHECK で整合を担保する。利用規約同意（018）の「2 列 + CHECK + 3 経路記録」パターンを踏襲するが、メール配信は**任意（オプトイン）**である点が異なり、サーバー側の必須ガードは設けず、デフォルト不許可・撤回可能とする。実際のメール送信処理はスコープ外で、本フィーチャーは同意の取得・記録・参照に責任を持つ。チェック UI は既存の汎用 `FormCheckbox` を内包する `EmailOptInField`（モーダル無し・ラベル/補足文を集約）を新設し、3 フォームで再利用する。

## Technical Context

**Language/Version**: TypeScript（strict）/ Next.js App Router / React（React Compiler）

**Primary Dependencies**: 既存のみ。Supabase Auth、React Hook Form、yup、Tailwind、既存 `FormCheckbox`（018）

**Storage**: Supabase（PostgreSQL）。`public.user_details` に `is_email_opted_in boolean not null default false` / `email_opted_in_at timestamptz`（nullable）を追加 + CHECK 制約。`handle_new_user` トリガー再定義（016/018 の分岐を維持しつつ配信同意を追記）。マイグレーション 1 本

**Testing**: Vitest（スキーマ・Server Actions・mapper・`EmailOptInField`）、Storybook、Playwright（E2E + axe-core a11y）

**Target Platform**: Web（service-front）。既存ログイン（`/login`）には非適用

**Project Type**: Web application（service-front + supabase マイグレーション）

**Performance Goals**: 特別な要件なし

**Constraints**: 既存ユーザーは `is_email_opted_in = false` / `email_opted_in_at = NULL`（grandfather）。CHECK で「許可=日時あり / 不許可=日時 NULL」を強制。トリガーは `security definer set search_path = ''` 維持。任意項目のためサーバー必須ガードなし。撤回時は日時 NULL クリア、ON 維持時は最初の許可日時を保持

**Scale/Scope**: 新規 `EmailOptInField` 1、共有スキーマ `emailOptInField` 1、スキーマ 3 本へ `emailOptIn` 追加、Server Action 4 本（signUp / completeProfile / getProfile / updateProfile）へ受け取り・記録、mapper 2 本更新、フォーム 3 本へチェック追加、DB マイグレーション 1。対象外: 実際のメール送信処理、既存ユーザーへの後追い同意取得、配信カテゴリ別の細分化

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 準拠状況 |
|------|---------|
| I. Spec-Driven Development | spec → plan → tasks の順。違反なし |
| II. Server Components First | 同意記録は Server Action / トリガー。チェック UI はインタラクションのため最小 Client。違反なし |
| III. Test-First | `EmailOptInField` は Vitest+Storybook+Playwright a11y、スキーマ/Actions/mapper は Vitest を同梱。違反なし |
| IV. Security & RLS by Default | 既存 `user_details` の RLS（SELECT/UPDATE 本人・INSERT 本人=016）が新列もカバー。新ポリシー不要。トリガー search_path 固定維持。違反なし |
| V. Accessibility（WCAG 2.1 AA） | `FormCheckbox` で label 関連付け・`aria-invalid`・補足文 `aria-describedby`・キーボード操作。違反なし |
| VI. Coding Standards | TypeScript strict / Feature-based / Tailwind / snake_case・boolean は `is_*` プレフィックス・timestamptz・3NF。違反なし |

**判定**: 違反なし。Complexity Tracking 記載なし。

## Project Structure

### Documentation (this feature)

```text
specs/022-email-consent/
├── spec.md / plan.md / research.md / data-model.md / quickstart.md
├── contracts/
│   ├── forms.md             # FormCheckbox 再利用 + EmailOptInField + 3 フォーム + スキーマ規則
│   └── server-actions.md    # signUp / completeProfile / getProfile / updateProfile の記録
└── tasks.md                 # /speckit-tasks 出力
```

### Source Code (repository root)

```text
service-front/src/
├── shared/schemas/fields.ts             # ★変更: emailOptInField を追加（任意 boolean・既定 false）
├── shared/components/form/
│   ├── EmailOptInField/                 # ★新規: FormCheckbox 内包・ラベル/補足文集約（+ test/stories/index）
│   └── index.ts                         # ★変更: EmailOptInField を再エクスポート
├── features/auth/
│   ├── schemas/
│   │   ├── signup.schema.ts             # ★変更: emailOptIn 追加
│   │   └── profile-completion.schema.ts # ★変更: emailOptIn 追加
│   ├── server/
│   │   ├── actions.ts                   # ★変更: signUp（options.data に email_opt_in）/ completeProfile（記録）
│   │   └── mappers/profile-completion.ts# ★変更: is_email_opted_in / email_opted_in_at を INSERT に
│   └── components/client/
│       ├── SignupForm/SignupForm.tsx           # ★変更: EmailOptInField 追加
│       └── ProfileCompletionForm/ProfileCompletionForm.tsx # ★変更: EmailOptInField 追加
├── features/account/
│   ├── schemas/profile.schema.ts        # ★変更: emailOptIn 追加
│   ├── server/
│   │   ├── actions.ts                   # ★変更: getProfile（取得列追加）/ updateProfile（OFF→ON 判定で記録）
│   │   └── mappers/profile.ts           # ★変更: opt-in 列を UPDATE に
│   └── components/client/ProfileEditForm/ProfileEditForm.tsx # ★変更: EmailOptInField 追加・初期値表示

supabase/migrations/
└── 20260701120000_add_email_opt_in.sql  # ★新規: user_details 2列追加 + CHECK + handle_new_user 再定義

packages/supabase/src/types.ts           # ★変更: user_details の Row/Insert/Update に opt-in 2列を反映
```

**Structure Decision**: Feature-based を踏襲。配信許可 UI は汎用 `FormCheckbox`（shared・018 で新設済み）を内包する `EmailOptInField` に集約し、ラベル・補足文（FR-011）を 1 箇所で管理して 3 フォームで再利用する。auth（登録）と account（設定画面）の両方から使う横断 UI のため、feature→feature 依存を避けて `shared/components/form/EmailOptInField/` に配置し、各フォームは `@/shared/components/form` の barrel 経由で import する。同意記録は `user_details` への列追加で 3 経路（トリガー / completeProfile / updateProfile）に最小組み込み。

## 設計の詳細

### データモデル（[data-model.md](data-model.md)）
`user_details` に `is_email_opted_in`（boolean, not null default false）/ `email_opted_in_at`（timestamptz, null可）を追加。CHECK `is_email_opted_in = (email_opted_in_at is not null)`。既存行は false / NULL（grandfather）。

### メール経路
1. `signup.schema` に `emailOptIn: emailOptInField`（任意 boolean・既定 false）。
2. `SignupForm` に `EmailOptInField`（モーダル無しの任意チェック・初期オフ）。
3. `signUp` Action: ガード無し。`options.data` に `email_opt_in: input.emailOptIn` を追加。
4. `handle_new_user` 再定義: メール経路 INSERT に `is_email_opted_in = coalesce((raw_user_meta_data->>'email_opt_in')::boolean, false)`、`email_opted_in_at` は真のときのみ `now()`（CHECK 整合のため条件付き）。

### Google 経路
1. `profile-completion.schema` に `emailOptIn` を追加。
2. `ProfileCompletionForm` に `EmailOptInField` を追加。
3. `completeProfile`: mapper が `is_email_opted_in` / `email_opted_in_at`（許可時のみ登録時刻）を INSERT に含める。

### 設定画面経路（US2）
1. `account/schemas/profile.schema` に `emailOptIn` を追加。
2. `getProfile` が `is_email_opted_in` を取得し `ProfileEditForm` の初期値に。
3. `ProfileEditForm` に `EmailOptInField` を追加。
4. `updateProfile`: 現在値を読み、OFF→ON で `email_opted_in_at = now()`、ON→OFF で NULL、ON 維持で既存日時保持（research Decision 5）。

### 任意項目としての扱い（018 との違い）
利用規約（必須・`oneOf([true])`・サーバー必須ガード）と異なり、メール配信は任意。`emailOptInField` は `oneOf` 無し、サーバーガード無し、デフォルト false。

### アクセシビリティ
`FormCheckbox`（018）の a11y 契約を再利用: `<input type="checkbox" id>` + `<label htmlFor>`、`aria-invalid`、補足文を `aria-describedby` で関連付け、Space 切替。

### 契約
[contracts/forms.md](contracts/forms.md) / [contracts/server-actions.md](contracts/server-actions.md)

## Complexity Tracking

違反なしのため記載事項なし。
