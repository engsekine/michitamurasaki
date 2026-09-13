# Implementation Plan: お問い合わせページ

**Branch**: `020-contact-page` | **Date**: 2026-06-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/020-contact-page/spec.md`

## Summary

公開（ログイン不要）の `/contact` ページにお問い合わせフォーム（氏名・メール・種別・本文）を設け、**入力 → 確認画面 → 送信 → 完了（サンクス）画面 `/contact/complete`** のフローで送信内容を Supabase の `inquiries` テーブルへ保存する。確認画面と入力画面の切替は `ContactForm`（Client Component）内のステップで行い、送信成功時に完了ページへ遷移する。送信は service-front の Server Action から `security definer` 関数 `submit_inquiry` を呼ぶ単一経路とし、SELECT を管理者のみに閉じたままレート制限・重複拒否・ハニーポットを実装する。運営者は admin-front の既存リソース基盤（`listResource` / `requireAdmin` / `recordAudit`）を再利用して一覧・詳細を閲覧し、不要な問い合わせを物理削除（監査ログ付き）できる。ログイン中ユーザーには氏名・メールを初期表示する。

## Technical Context

**Language/Version**: TypeScript（strict mode）/ Next.js App Router（React 19 + React Compiler）

**Primary Dependencies**: Supabase（PostgreSQL + Auth + RLS）, React Hook Form + yup, Tailwind CSS, `@repo/supabase`（生成 Database 型）, `@repo/ui`, `resend`（メール送信 HTTP API）, `@react-email/components`（メール JSX テンプレート）, `@react-email/render`（JSX → HTML / プレーンテキスト変換）

**Storage**: Supabase PostgreSQL。新規テーブル `public.inquiries`（RLS 有効）+ `security definer` 関数 `public.submit_inquiry`

**Testing**: Vitest（単体・lib / schema / mappers）, Storybook + Playwright（axe-core, フォームの a11y）。マイグレーションは `supabase db reset` で適用確認

**Target Platform**: Web（service-front = 一般利用者向け公開ページ、admin-front = 運営者向け管理画面）

**Project Type**: Web application（既存 monorepo: `service-front` / `admin-front` / `packages/*` / `supabase`）

**Performance Goals**: 送信〜受付完了は通常ネットワークで 2 秒以内（SC-001 の体感目標に対応）。一覧はページャ（既定 perPage）で N+1 を避ける

**Constraints**: 公開フォームのため anon からの書き込みを許可しつつ SELECT は管理者限定。個人情報を含むため本文・氏名等は表示時にフレームワークの自動エスケープに委ね、生 HTML 描画を行わない（FR-015）。レート制限は IP 単位、しきい値は research.md で確定

**Scale/Scope**: 小規模（問い合わせは低頻度）。新規画面 = 公開 1 画面（`/contact`）+ 管理 2 画面（一覧・詳細）。新規テーブル 1・DB 関数 1・マイグレーション 1〜2 本

## Constitution Check

*GATE: Phase 0 research 前に通過必須。Phase 1 design 後に再確認。*

| 原則 | 準拠方針 | 判定 |
|---|---|---|
| I. Spec-Driven Development | 本 plan は spec.md / clarifications を起点に作成。実装後にズレがあれば spec を実装に合わせて更新 | PASS |
| II. Server Components First | `/contact` ページ・管理一覧/詳細は Server Component。フォーム送信・削除のみ Client Component + Server Action。データ取得は Server 側。ページは `generatePageMetadata` で metadata を出力 | PASS |
| III. Test-First | schema（yup）・mapper・rate-limit/honeypot 判定 lib を先にテスト。フォーム/一覧コンポーネントは Vitest + Storybook + Playwright(a11y) を同梱（`/generate-with-tests`） | PASS |
| IV. Security & RLS by Default | `inquiries` は RLS 有効。SELECT/DELETE は `(select public.is_admin())` のみ。書き込みは `security definer` 関数経由（`set search_path = ''`）。マイグレーション SQL 経由のみ | PASS |
| V. Accessibility (WCAG 2.1 AA) | フォームは label 関連付け・`aria-required`・エラー `role="alert"`・`aria-invalid`。送信完了は `aria-live`。ハニーポットは `aria-hidden` + ラベル付きで支援技術に露出させない | PASS |
| VI. Coding Standards | TypeScript strict・`any` 不可（監査ログ既存箇所の型境界を除く）、Feature-based 配置、Tailwind utility-first、snake_case/3NF/timestamptz、命名は readable-code に準拠 | PASS |

**Gate 結果**: 違反なし。Complexity Tracking は不要。

**セキュリティ強化（2026-07-02 監査）**: `submit_inquiry` は 20260702110400 で強化: `submitter_user_id` は引数でなく `auth.uid()` を記録（偽装防止）。IP 非依存のレート制限（同一メール宛 3件/60秒・同一メール+本文の重複拒否・全体 20件/60秒）を追加。XFF 先頭値は偽装可能なため IP ベースの制限は防御の一層にすぎない。

## Project Structure

### Documentation (this feature)

```text
specs/020-contact-page/
├── plan.md              # This file
├── research.md          # Phase 0 output（技術判断）
├── data-model.md        # Phase 1 output（inquiries テーブル・関数）
├── quickstart.md        # Phase 1 output（検証手順）
├── contracts/           # Phase 1 output
│   ├── contact-submit.md     # 公開フォーム送信契約（submit_inquiry）
│   └── admin-inquiries.md    # 管理: 一覧・詳細・削除契約
└── checklists/
    └── requirements.md  # /speckit-specify で作成済み
```

### Source Code (repository root)

```text
supabase/migrations/
└── 20260629110000_create_inquiries.sql        # inquiries テーブル + RLS + submit_inquiry 関数 + 管理者 RLS

packages/supabase/src/
└── database.types.ts                           # supabase gen types で再生成（inquiries / submit_inquiry を反映）

# ── service-front（一般利用者向け公開フォーム）──
service-front/src/
├── app/(public)/contact/
│   ├── page.tsx                                # 入力ページ（Server Component, metadata, Breadcrumbs）
│   └── complete/page.tsx                       # 完了（サンクス）ページ（Server Component, metadata）
├── features/contact/
│   ├── index.ts                                # PAGE_DATA / COMPLETE_PAGE_DATA / 公開 export
│   ├── constants.ts                            # 種別の選択肢/ラベル変換・本文上限・PAGE_DATA・COMPLETE_PAGE_DATA・完了パス
│   ├── schemas/
│   │   └── contact.schema.ts                   # yup スキーマ（氏名/メール/種別/本文/ハニーポット）
│   ├── emails/
│   │   ├── InquiryNotificationEmail.tsx        # 運営者通知メール JSX テンプレート（FR-021）
│   │   └── InquiryAutoReplyEmail.tsx           # 送信者自動返信メール JSX テンプレート（FR-022）
│   ├── server/
│   │   ├── actions.ts                          # submitInquiry Server Action（保存 → メール送信 → 失敗時 discard）
│   │   └── email.ts                            # sendInquiryNotifications（react-email render + Resend 送信）
│   ├── lib/
│   │   └── prefill.ts                          # ログイン中ユーザーの氏名・メール初期値生成（+ test）
│   └── components/client/ContactForm/
│       ├── ContactForm.tsx                     # RHF + yup、入力⇄確認のステップ、送信成功で完了ページへ遷移
│       ├── ContactForm.test.tsx
│       ├── ContactForm.stories.tsx
│       └── index.ts

# ── admin-front（運営者向け閲覧・削除）──
admin-front/src/
├── app/(admin)/inquiries/
│   ├── page.tsx                                # 一覧（listInquiries）
│   └── [id]/page.tsx                           # 詳細（getInquiryDetail）+ 削除アクション
├── features/inquiries-admin/
│   ├── index.ts
│   ├── server/
│   │   ├── queries.ts                          # listInquiries / getInquiryDetail（requireAdmin + listResource）
│   │   └── actions.ts                          # deleteInquiry（hardDeleteRow + recordAudit + revalidate）
│   └── components/client/DeleteInquiryButton/
│       ├── DeleteInquiryButton.tsx
│       ├── DeleteInquiryButton.test.tsx
│       └── index.ts
└── shared/components/layout/AdminShell/
    └── AdminSidebar.tsx                        # ナビに「お問い合わせ」を追加（編集）

# ── 共通導線 ──
service-front/src/shared/components/layout/Footer/
└── Footer.tsx                                  # フッターに /contact リンク追加（編集・FR-016）
```

**Structure Decision**: 既存 Feature-based + shared/ アーキテクチャ（`arch/feature-based.md`）に従い、公開フォームは `service-front/src/features/contact`、運営閲覧は `admin-front/src/features/inquiries-admin` に新規 feature として分離する。両者は同一テーブル `inquiries` を介してのみ連携し、フロント間の直接 import は行わない。admin 側は既存の汎用リソース基盤（`@/shared/lib/resource/*`・`requireAdmin`・`recordAudit`）を最大限再利用し、新規コードを最小化する。

## Complexity Tracking

> Constitution Check に違反なし。記載不要。
