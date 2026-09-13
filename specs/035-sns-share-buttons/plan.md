# Implementation Plan: SNS 共有ボタン

**Branch**: `035-sns-share-buttons` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/035-sns-share-buttons/spec.md`

## Summary

公開ダイビングログ詳細（`/dives/[id]`）とユーザープロフィール（`/users/[slug]`）に、X・Facebook のブランドアイコン付き共有ボタンを追加する。公式 Web Intent / 共有ダイアログ URL をアンカーで新しいタブに開く。汎用コンポーネント `SnsShareButtons`（状態を持たない Server Component）を `shared/components/social/` に新設し、`DiveDetail`（公開ログのみ）と `PublicProfile` から埋め込む。DB 変更なし。

※ 2026-07-16 改定: 当初計画していた Instagram 共有（コピー + Instagram を開く方式）は UX が不十分なため削除（spec Clarifications / research.md R3）。

## Technical Context

**Language/Version**: TypeScript（strict mode）/ Node.js 24

**Primary Dependencies**: Next.js（App Router）・React（React Compiler）・Tailwind CSS。新規依存の追加なし（ブランドアイコンは SVG 同梱、lucide-react は X ロゴ非収録のため使わない）

**Storage**: N/A（DB 変更・新規データ保存なし）

**Testing**: Vitest（単体）・Storybook（story）・Playwright + axe-core（a11y / e2e）

**Target Platform**: Web（service-front のみ。admin-front は対象外）

**Project Type**: Web application（モノレポ内 service-front ワークスペース）

**Performance Goals**: 追加はプレゼンテーショナルな軽量コンポーネントのみ。データフェッチ・バンドルへの影響は無視できる規模（SVG 3 点 + 小さなクライアントコンポーネント 1 点）

**Constraints**: 共有リンク先の閲覧はログイン必須（021 / 034 の既存仕様を変更しない）。外部 SDK・API キーを導入しない。共有 URL は `SITE_URL` ベースの canonical URL とする

**Scale/Scope**: 画面 2 箇所（ログ詳細・プロフィール）への埋め込み + 新規共有コンポーネント 1 式。DB・サーバー層の変更なし

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 判定 | 根拠 |
|------|------|------|
| I. Spec-Driven Development | PASS | spec 035 承認済み。plan → tasks → 実装の順で進める |
| II. Server Components First | PASS | 新規クライアント境界なし。`SnsShareButtons` は状態を持たない Server Component（Instagram 削除の改定でクリップボード操作が不要になった）。埋め込み元の `DiveDetail` / `PublicProfile` も Server Component のまま |
| III. Test-First | PASS | `SnsShareButtons` は `src/shared/components/**` 配下のため Vitest + Storybook + Playwright a11y を同梱（`/generate-with-tests` 対象）。編集する既存コンポーネントのテスト・story も同期更新する |
| IV. Security & RLS by Default | PASS | DB 変更なし。共有 URL は既存のアクセス制御（RLS）のままで、公開範囲を一切広げない（FR-007）。外部リンクは `rel="noopener noreferrer"` を付与 |
| V. Accessibility（WCAG 2.1 AA） | PASS | 各ボタンに「X で共有」等のアクセシブルな名前、アイコンは `aria-hidden`、コピー結果は `role="status"` / `role="alert"` で通知（FR-009 / FR-010）。既存の aria-live パターンを踏襲 |
| VI. Coding Standards | PASS | コンポーネントフォルダ規約（本体 + test + stories + index.ts）、Tailwind utility-first、named export に従う |

**Post-Design Re-check（Phase 1 完了後）**: 違反なし。Complexity Tracking への記載事項なし。

## Project Structure

### Documentation (this feature)

```text
specs/035-sns-share-buttons/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── sns-share-buttons.md  # UI コンポーネント契約
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
service-front/
├── src/
│   ├── shared/
│   │   └── components/
│   │       └── social/
│   │           └── SnsShareButtons/            # 新規（横断 UI のため shared/）
│   │               ├── SnsShareButtons.tsx      # 本体（状態なしの Server Component）
│   │               ├── SnsBrandIcons.tsx        # X / Facebook の SVG（内部ファイル）
│   │               ├── SnsShareButtons.test.tsx # Vitest 単体テスト
│   │               ├── SnsShareButtons.stories.tsx
│   │               └── index.ts                 # 再 export
│   ├── features/
│   │   ├── dives/
│   │   │   └── components/
│   │   │       └── server/
│   │   │           └── DiveDetail/
│   │   │               ├── DiveDetail.tsx       # 変更: 公開ログのとき SnsShareButtons を描画
│   │   │               ├── DiveDetail.test.tsx  # 同期更新
│   │   │               └── DiveDetail.stories.tsx # 同期更新
│   │   └── social/
│   │       └── components/
│   │           └── server/
│   │               └── PublicProfile/
│   │                   ├── PublicProfile.tsx    # 変更: SnsShareButtons を描画
│   │                   └── index.ts
│   └── shared/lib/profile-path/                 # 既存（プロフィール URL 生成に使用・変更なし）
└── tests/
    ├── sns-share.spec.ts                        # 新規: US1 / US2 の e2e シナリオ
    └── a11y/
        └── dives-pages.spec.ts                  # 変更: 公開切替後（共有ボタン表示時）の a11y 検証を追加
```

※ e2e は `tests/social-flows.spec.ts` への追記ではなく新規ファイル `tests/sns-share.spec.ts` に分離した（別作業の未コミット変更との混線回避 + ファイル間の直列制約解消）。プロフィールページの a11y は既存の `tests/a11y/social-pages.spec.ts` のスイープが `/users/<id>` を検査しており、共有ボタンは常時表示のため追記なしでカバーされる。

**Structure Decision**: 既存の Feature-based + shared/ アーキテクチャに従う。`SnsShareButtons` は dives / social の 2 feature から使う横断 UI のため `src/shared/components/social/` に配置（`app/` → `features/` → `shared/` の依存方向を維持）。ブランド SVG は独立したアイコンコンポーネント群にせず、`SnsShareButtons` フォルダ内の内部ファイル `SnsBrandIcons.tsx` に閉じ込める（外部からは index.ts 経由で `SnsShareButtons` のみ公開。admin-front では使用しないため `@repo/ui` にも置かない）。

## 設計詳細

### コンポーネント契約

[contracts/sns-share-buttons.md](./contracts/sns-share-buttons.md) を参照。要点:

- `SnsShareButtons` の Props は `{ url: string; text: string }` の 2 つのみ。共有 URL・共有テキストの組み立ては埋め込み元の Server Component が行う
- X: `https://x.com/intent/post?text=<text>&url=<url>`（`URLSearchParams` でエンコード）
- Facebook: `https://www.facebook.com/sharer/sharer.php?u=<url>`（テキストは Facebook 仕様で引き渡し不可）

### 埋め込み箇所

| 画面 | 埋め込み元 | 表示条件 | url / text |
|------|-----------|---------|-----------|
| ログ詳細 `/dives/[id]` | `DiveDetail`（Server） | `dive.isPublic === true`（所有者・閲覧者共通） | `${SITE_URL}/dives/${dive.id}` / 「{場所}のダイビングログ（{YYYY/MM/DD}）| {SITE_NAME}」 |
| プロフィール `/users/[slug]` | `PublicProfile`（Server） | 常時（自分・他人とも） | `${SITE_URL}${profilePath(profile)}` / 「{ニックネーム}のダイビングプロフィール | {SITE_NAME}」 |

既存の所有者向け共有リンクコピー UI（`DiveVisibilityToggle` 内）は変更しない。SNS 共有ボタンはその近傍ではなく `DiveDetail` 直下の独立セクションとして置き、非所有者にも表示されるようにする（US1-6）。

### 主要な技術決定（research.md より）

| # | 決定 | 参照 |
|---|------|------|
| R1 | X は Web Intent（x.com/intent/post）をアンカーで開く | [research.md#R1](./research.md) |
| R2 | Facebook は sharer.php（App ID 不要）をアンカーで開く | [research.md#R2](./research.md) |
| R3 | Instagram 共有は提供しない（2026-07-16 改定。Web Share API は将来拡張） | [research.md#R3](./research.md) |
| R4 | ブランドアイコンは SVG 同梱（lucide-react 不使用） | [research.md#R4](./research.md) |
| R5 | `SnsShareButtons` を shared/ に新設（状態なしの Server Component） | [research.md#R5](./research.md) |
| R6 | URL は SITE_URL / profilePath ベース、テキストは呼び出し元で組み立て | [research.md#R6](./research.md) |

## Complexity Tracking

Constitution Check に違反なし。記載事項なし。
