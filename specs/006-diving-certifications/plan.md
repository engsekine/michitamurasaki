# Implementation Plan: ダイビングライセンス保有資格管理

**Branch**: `006-diving-certifications` | **Date**: 2026-06-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-diving-certifications/spec.md`

## Summary

ユーザーが保有するダイビングライセンス資格（指導団体・資格ランク・取得日）を複数件登録・一覧・編集・削除でき、取得日から保有期間（経過年月）を自動表示する機能。データは Supabase の `certifications` テーブルに保持し、所有者制限は RLS で保証する。画面は既存の機材管理（`settings/equipment` = `features/regulators`）と同型の settings 配下 3 画面構成とし、一覧は Server Component、フォーム・削除は Server Actions で行う。

## Technical Context

**Language/Version**: TypeScript（strict mode）/ React 19 / Next.js 16（App Router、React Compiler 有効）

**Primary Dependencies**: React Hook Form + yup（フォーム・バリデーション）、Tailwind CSS（スタイリング）、`@repo/supabase`（Supabase クライアント）、`@repo/ui`（共通 UI）。日付計算ライブラリは追加しない（[research.md R3](research.md)）

**Storage**: Supabase（PostgreSQL）。`public.certifications` テーブル + RLS。スキーマはマイグレーション SQL ファイル管理（[data-model.md](data-model.md) 参照)

**Testing**: Vitest（yup スキーマ・保有期間計算・Server Actions・コンポーネント単体）、Storybook（story + テスト）、Playwright（a11y）

**Target Platform**: Web（モバイル / タブレット / PC、モバイルファースト）

**Project Type**: Web アプリケーション（モノレポ内 `service-front`）

**Performance Goals**: 1 ユーザーの資格は高々数十件のため一覧はページネーション不要の全件取得。一覧表示は Server Component の 1 クエリで完結させる

**Constraints**: WCAG 2.1 AA 準拠 / RLS 必須 / `user_id` は Server Action 側で `auth.uid()` から強制セット / 取得日は「未来日付不可」（JST 基準（`todayInJst`）で yup + Server Action が検証。DB CHECK は `current_date + 1` の安全網）と「生年月日以降」（Server Action でクロステーブル検証）

**Scale/Scope**: 1 ユーザーあたり数件〜十数件。画面 3 つ（一覧 / 新規 / 編集）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 準拠 | 確認内容 |
|------|------|---------|
| I. Spec-Driven Development | ✅ | spec.md 承認済み。本 plan → tasks → 実装の順で進める |
| II. Server Components First | ✅ | 一覧（CertificationList）は Server Component。Client は CertificationForm / DeleteCertificationButton の最小範囲。ページは `generatePageMetadata` を使用 |
| III. Test-First | ✅ | yup スキーマ・`heldPeriod.ts`・Server Actions のテストを実装より先に書く。コンポーネントは `/generate-with-tests` で test / story / a11y を同梱 |
| IV. Security & RLS by Default | ✅ | `certifications` に RLS 4 ポリシー（select / insert / update / delete、すべて `(select auth.uid()) = user_id`）。マイグレーションファイル経由のみ |
| V. Accessibility | ✅ | フォームは label 関連付け・`aria-invalid`・エラー `role="alert"`。削除は確認ダイアログ。Playwright + axe-core で検証 |
| VI. Coding Standards | ✅ | snake_case / text + CHECK / timestamptz / `*_on` 日付サフィックス（`acquired_on`）。Feature-based 構成・コンポーネントフォルダ規約に準拠 |

**Phase 1 設計後の再評価**: 違反なし。導出値（保有期間）を保存しない設計は sql.md の正規化原則にも適合（Complexity Tracking 不要）。

## Project Structure

### Documentation (this feature)

```text
specs/006-diving-certifications/
├── spec.md              # 機能仕様
├── plan.md              # This file
├── research.md          # Phase 0: 設計判断の記録
├── data-model.md        # certifications テーブル定義（カラム・制約・RLS・トリガ）
├── quickstart.md        # 動作検証手順
├── checklists/
│   └── requirements.md  # spec 品質チェックリスト
└── tasks.md             # Phase 2 出力（/speckit-tasks で生成 — 本コマンドでは作らない）
```

contracts/ は作成しない。外部公開 API はなく、インターフェースは Server Actions（`features/certifications/server/actions.ts`）に閉じるため、その入出力は data-model.md と本ファイルで定義する。

### Source Code (repository root)

```text
supabase/
└── migrations/
    └── <timestamp>_create_certifications.sql   # テーブル + 制約 + RLS + インデックス + トリガ

service-front/src/
├── app/(authenticated)/settings/certifications/
│   ├── page.tsx                                # 一覧（/settings/certifications）
│   ├── new/page.tsx                            # 新規登録（/settings/certifications/new）
│   └── [id]/edit/page.tsx                      # 編集（/settings/certifications/[id]/edit）
└── features/certifications/
    ├── components/
    │   ├── server/
    │   │   └── CertificationList/              # 一覧 + 空状態表示（Server Component）
    │   └── client/
    │       ├── CertificationForm/              # 新規・編集で共有（RHF + yup）
    │       └── DeleteCertificationButton/      # 確認ダイアログ付き削除
    ├── lib/
    │   ├── heldPeriod.ts                       # 取得日 → 保有期間（純粋関数）
    │   ├── heldPeriod.test.ts
    │   ├── specialtyTags.ts                    # タグ入力文字列 → タグ配列（純粋関数）
    │   └── specialtyTags.test.ts
    ├── schemas/
    │   ├── certification.schema.ts             # yup スキーマ
    │   └── certification.schema.test.ts
    ├── server/
    │   ├── queries.ts                          # 一覧・1 件取得（Server Component 用）
    │   └── actions.ts                          # create / update / delete（Server Actions）
    ├── constants.ts                            # 指導団体の値 → 表示ラベル
    ├── types.ts
    └── index.ts
```

**Structure Decision**: 既存の `features/regulators`（settings/equipment）と同型の Feature-based 構成を踏襲する（[research.md R6](research.md)）。コンポーネントは CLAUDE.md のフォルダ規約（本体 + test + stories + index.ts）に従う。

## 設計詳細

### Server Actions インターフェース

| Action | 入力 | 検証 | 出力 |
|--------|------|------|------|
| `createCertification` | `{ agency, rank, acquiredOn, diverNumber, instructorNumber, trainedBy, acquiredLocation, specialtyTags, diveId }` | yup スキーマ → 生年月日以降チェック → `diveId` 指定時は自分のログとして見えるか確認 → insert（23505 は重複エラーに変換）→ タグを `certification_tags` へ insert | 成功時 `/settings/certifications` へ revalidate + redirect |
| `updateCertification` | `{ id, agency, rank, acquiredOn, diverNumber, instructorNumber, trainedBy, acquiredLocation, specialtyTags, diveId }` | 同上 + RLS による所有者確認。タグは削除 + 再挿入で置き換える | 同上 |
| `deleteCertification` | `{ id }` | RLS による所有者確認。タグは `on delete cascade` で同時に削除 | 成功時一覧を revalidate |

生年月日チェックで `user_details` が取得できない場合は、チェックをスキップせず登録・更新を拒否してエラーを表示する（防御的挙動）。一覧クエリの並び順は `acquired_on desc, created_at desc`（同日取得の表示順を安定させる）。

スペシャリティタグはフォームではカンマ（, / 、）区切りのテキスト入力（`specialtyTags: string`）とし、`lib/specialtyTags.ts` の `parseSpecialtyTags` が trim・空要素除外・重複排除して配列化する。DB は 1NF を守るため子テーブル `certification_tags` で保持する（[data-model.md 6.5 節](data-model.md)）。

取得ダイブ（`diveId`）のセレクト選択肢は、feature 間 import 禁止のためページ層（app）で `features/dives` の `listDiveOptions()` を呼び、`features/certifications` の `toDiveSelectOptions()` で「YYYY/MM/DD ポイント名」ラベルに変換して `CertificationForm` に props 注入する。一覧の取得ダイブ表示はクエリの join（`dive:dives(id, dive_date, location)`）で取得し、`/dives/[id]` へのリンクとして表示する。

`user_id` はクライアントから受け取らず、Server Action 内で `auth.uid()` から設定する。

### 保有期間の計算仕様（`heldPeriod.ts`）

- 入力: `acquiredOn: string`（YYYY-MM-DD）、基準日 `today: string`（YYYY-MM-DD、JST 基準の値。テスト容易性のため引数で受け取る。`shared/lib/date.ts` の `daysUntil` 等と同じ文字列ベースの規約に合わせ、タイムゾーン差の混入を防ぐ）
- 出力: `{ years: number, months: number }`（月数切り捨て。最小 `{ years: 0, months: 0 }`）
- 表示: 1 年以上は「○年○ヶ月」、1 年未満は「○ヶ月」、取得当日は「0ヶ月」

### エラーメッセージ方針

| ケース | メッセージ（案） |
|--------|----------------|
| 未来日付 | 取得日には今日以前の日付を入力してください |
| 生年月日より前 | 取得日には生年月日以降の日付を入力してください |
| 重複登録 | 同じ団体・ランクの資格がすでに登録されています |

## Complexity Tracking

違反なしのため記載なし。
