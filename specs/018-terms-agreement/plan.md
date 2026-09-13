# Implementation Plan: 新規登録時の利用規約同意

**Branch**: `018-terms-agreement` | **Date**: 2026-06-26 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/018-terms-agreement/spec.md`

## Summary

メール登録（`/signup`）と Google 初回ログイン（`/profile-completion`）の両経路に「利用規約に同意する」チェックを追加し、未同意では新規登録／利用開始をさせない。利用規約は**モーダルで全文表示し、最後までスクロールするまで同意チェックを無効化**する（未読同意の防止、FR-005/FR-005b）。同意の事実（同意日時・規約バージョン）を `user_details` に記録して監査可能にする。チェック UI は汎用 `FormCheckbox` を新設し、モーダル＋スクロール判定を内包する `TermsAgreementField`（規約本文は `/terms` と共有の `TermsContent`）を両フォームで再利用する。サーバー側（`signUp` / `completeProfile`）でも未同意を拒否する（二重防御）。記録は `handle_new_user` トリガー（メール経路）と `completeProfile` の INSERT（Google 経路）に組み込む。

## Technical Context

**Language/Version**: TypeScript（strict）/ Next.js App Router / React（React Compiler）

**Primary Dependencies**: 既存のみ。Supabase Auth、React Hook Form、yup、Tailwind、`@repo/ui` の Button

**Storage**: Supabase（PostgreSQL）。`public.user_details` に `terms_version text` / `terms_agreed_at timestamptz`（ともに nullable）を追加 + CHECK 制約。`handle_new_user` トリガー再定義（016 の分岐を維持しつつ同意情報を追記）。マイグレーション 1 本

**Testing**: Vitest（スキーマ・Server Actions・mapper・`FormCheckbox`）、Storybook、Playwright（E2E + axe-core a11y）

**Target Platform**: Web（service-front）。既存ログイン（`/login`）には非適用

**Project Type**: Web application（service-front + supabase マイグレーション）

**Performance Goals**: 特別な要件なし

**Constraints**: 既存ユーザーは両列 NULL（grandfather）。`terms_version` と `terms_agreed_at` は CHECK で「両方 NULL or 両方 NOT NULL」。トリガーは `security definer set search_path = ''` 維持。`agreed_at` はサーバー時刻（メール経路 `now()`）

**Scale/Scope**: 新規 `FormCheckbox` 1、スキーマ 2 本へ `agreedToTerms` 追加、Server Action 2 本へ同意ガード＋記録、mapper 更新、フォーム 2 本へチェック追加、DB マイグレーション 1、規約バージョン定数 1。対象外: 規約改定時の再同意、同意撤回

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 準拠状況 |
|------|---------|
| I. Spec-Driven Development | spec → plan → tasks の順。違反なし |
| II. Server Components First | 同意記録は Server Action / トリガー。チェック UI はインタラクションのため最小 Client。違反なし |
| III. Test-First | `FormCheckbox` は Vitest+Storybook+Playwright a11y、スキーマ/Actions/mapper は Vitest を同梱。違反なし |
| IV. Security & RLS by Default | 既存 `user_details` の RLS（SELECT/UPDATE 本人・INSERT 本人=016）が新列もカバー。新ポリシー不要。トリガー search_path 固定維持。サーバー側ガードで未同意拒否。違反なし |
| V. Accessibility（WCAG 2.1 AA） | `FormCheckbox` で label 関連付け・`aria-invalid`・エラー `role="alert"`・キーボード操作。違反なし |
| VI. Coding Standards | TypeScript strict / Feature-based / Tailwind / snake_case・timestamptz・3NF。違反なし |

**判定**: 違反なし。Complexity Tracking 記載なし。

## Project Structure

### Documentation (this feature)

```text
specs/018-terms-agreement/
├── spec.md / plan.md / research.md / data-model.md / quickstart.md
├── contracts/
│   ├── forms.md             # FormCheckbox + 両フォームの同意フィールド + スキーマ規則
│   └── server-actions.md    # signUp / completeProfile の同意ガード・記録
└── tasks.md                 # /speckit-tasks 出力
```

### Source Code (repository root)

```text
service-front/src/
├── shared/
│   ├── components/form/FormCheckbox/   # ★新規: 汎用チェックボックス（+ test/stories/index）
│   │   └── （form/index.ts に再エクスポート追記）
│   └── constants/terms.ts              # ★新規: CURRENT_TERMS_VERSION
├── features/terms/components/
│   └── TermsContent/                   # ★新規: 規約本文（TermsView と共有）。TermsView は h1 + TermsContent に
├── features/auth/
│   ├── schemas/
│   │   ├── signup.schema.ts            # ★変更: agreedToTerms 追加
│   │   └── profile-completion.schema.ts# ★変更: agreedToTerms 追加
│   ├── server/
│   │   ├── actions.ts                  # ★変更: signUp（terms_version を data に＋ガード）/ completeProfile（ガード）
│   │   └── mappers/profile-completion.ts # ★変更: terms_version / terms_agreed_at を INSERT に
│   └── components/client/
│       ├── TermsAgreementField/        # ★新規: 規約モーダル＋末尾スクロールで同意可（+ isScrolledToBottom + test/stories）
│       ├── SignupForm/SignupForm.tsx           # ★変更: TermsAgreementField 追加
│       └── ProfileCompletionForm/ProfileCompletionForm.tsx # ★変更: TermsAgreementField 追加

supabase/migrations/
└── 20260626100000_add_terms_agreement.sql  # ★新規: user_details 2列追加 + CHECK + handle_new_user 再定義
```

**Structure Decision**: Feature-based を踏襲。同意 UI は汎用 `FormCheckbox`（shared）を内包する `TermsAgreementField`（auth feature）に集約し、規約モーダル＋末尾スクロール判定を持たせて両フォームで再利用。規約本文は `features/terms` の `TermsContent` を `/terms` ページと共有。同意記録は `user_details` への列追加で両経路（トリガー／completeProfile）に最小組み込み。

## 設計の詳細

### データモデル（[data-model.md](data-model.md)）
`user_details` に `terms_version`（text, null可）/ `terms_agreed_at`（timestamptz, null可）を追加。CHECK `(terms_version is null) = (terms_agreed_at is null)`。既存行は NULL。

### メール経路
1. `signup.schema` に `agreedToTerms: boolean`（`oneOf([true])`・必須）。
2. `SignupForm` に `TermsAgreementField`（「利用規約を読む」モーダル＋末尾スクロールで同意可の「利用規約に同意する」チェック）。未チェックで送信→エラー。
3. `signUp` Action: `agreedToTerms !== true` ならガードで `actionFailure`。`options.data` に `terms_version: CURRENT_TERMS_VERSION` を追加。
4. `handle_new_user` 再定義: メール経路 INSERT に `terms_version = raw_user_meta_data->>'terms_version'` を追加し、`terms_agreed_at` は `terms_version` がある場合のみ `now()`（`case when ... ? 'terms_version' then now() else null end`）とする（016 の `? 'nickname'` 分岐内）。無条件 `now()` は CHECK 違反でサインアップを壊すため条件付き。

### Google 経路
1. `profile-completion.schema` に `agreedToTerms` を追加。
2. `ProfileCompletionForm` に `TermsAgreementField` を追加。
3. `completeProfile`: ガード（未同意拒否）後、mapper が `terms_version = CURRENT_TERMS_VERSION` / `terms_agreed_at`（登録時刻）を INSERT に含める。

### サーバー側ガード（FR-008）
`signUp` / `completeProfile` の冒頭で同意フラグを検証。クライアント無効化に依存しない。

### アクセシビリティ
`FormCheckbox`: `<input type="checkbox" id>` ＋ `<label htmlFor>`、`aria-invalid`、エラーは `role="alert"` で `aria-describedby` 関連付け、`aria-required`。規約モーダルは `@repo/ui` Dialog（Radix）でフォーカストラップ・Esc・`aria-modal` を担保。

### 契約
[contracts/forms.md](contracts/forms.md) / [contracts/server-actions.md](contracts/server-actions.md)

## Complexity Tracking

違反なしのため記載事項なし。
