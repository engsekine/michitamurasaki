# Implementation Plan: バディ・フォロー・タイムライン（ソーシャル機能）

**Branch**: `021-buddy-follow-timeline` | **Date**: 2026-06-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/021-buddy-follow-timeline/spec.md`

## Summary

ダイブログに「同行バディ（登録ユーザー／フリーテキスト）」を記録できるようにし、それを起点に **フォロー（承認不要・一方向）**・**ログの公開/非公開**・**TOP タイムライン**・**バディ検索（013 拡張）** を実現するソーシャルレイヤーを追加する。

> **改定（2026-07-01）**: 匿名共有ページ `/(public)/shared/dives/[slug]` と `get_public_dive(slug)` RPC を廃止し、公開ログの閲覧はログイン済みユーザー向けの `/dives/[id]` に統合した。共有リンクは dive id ベース（`{SITE_URL}/dives/[id]`）。編集・削除・PDF 出力・公開設定は作成者本人のみ。以下の記述のうち匿名共有・`public_slug`・`get_public_dive` に関する部分はこの改定で置き換わっている。

技術アプローチ:
- **DB（Supabase）**: 新規テーブル `dive_log_buddies`（dives×users/フリーテキストの中間）・`user_follows`（自己参照フォロー関係）を追加。既存 `dives.is_public` を活性化し、`dives` に「公開ログは authenticated が閲覧可」の RLS を追加（この RLS が `/dives/[id]` での他人の公開ログ閲覧・タイムライン・公開プロフィールを支える）。匿名共有用の `get_public_dive(slug)` は当初追加したが 2026-07-01 に撤去（`20260701130000_drop_get_public_dive_fn.sql`）。
- **service-front（Next.js App Router）**: 新規 feature `social`（フォロー・タイムライン・公開プロフィール）を追加し、`dives` feature を拡張（バディ入力・公開トグル・バディ検索）。TOP（`src/app/page.tsx`）にタイムラインを app 層で合成注入。公開ログの閲覧は認証済みの `/dives/[id]` に統合（作成者以外は編集・削除・公開設定・PDF を非表示）。
- Server Components デフォルト、変更系は Server Actions、状態は最小限の Client Component に限定。

## Technical Context

**Language/Version**: TypeScript（strict）/ Next.js App Router（React Compiler 有効）

**Primary Dependencies**: Supabase JS（PostgreSQL + Auth + RLS）、React Hook Form + yup（フォーム）、@tanstack/react-query（一覧の infinite query）、Tailwind CSS

**Storage**: Supabase（PostgreSQL）。新規テーブル `dive_log_buddies` / `user_follows`、既存 `dives` の公開カラム活性化 + RLS 追加。すべてマイグレーション SQL 経由

**Testing**: Vitest（単体）、Storybook、Playwright + axe-core（a11y）

**Target Platform**: Web（認証済みエリア。※改定前は匿名公開ページ 1 種を含んだが 2026-07-01 に廃止）

**Project Type**: Web application（service-front 単一 Next.js アプリ + Supabase）

**Performance Goals**: タイムライン最新 20 件 2 秒以内（SC-004）、フォロー操作 3 秒以内反映（SC-003）、バディ検索 1 秒以内（SC-006）。一覧はキーセットページネーション維持

**Constraints**: 非公開ログは所有者以外に一切露出しない（SC-002 = 事故 0）。アクセス制御は RLS が一次防御（constitution IV）。WCAG 2.1 AA

**Scale/Scope**: 1 ユーザー数百〜数千ログ、フォローは数百規模を想定。変更は `dives` feature 拡張 + 新規 `social` feature + マイグレーション 4 本 + TOP/プロフィール/共有の各ルート

## Constitution Check

*GATE: Phase 0 前に通過必須。Phase 1 後に再評価。*

| 原則 | 判定 | 根拠 |
|---|---|---|
| I. Spec-Driven Development | PASS | spec.md（clarify 済み）→ 本 plan → tasks の順。実装時にズレたら spec を更新 |
| II. Server Components First | PASS | プロフィール／タイムライン／共有ページは Server Component で SSR フェッチ。フォローボタン・バディ入力・公開トグルのみ Client Component に限定。変更系は Server Actions |
| III. Test-First | PASS | 新規 lib（マッパー・バリデーション・タイムライン整形）は Vitest 先行。新規コンポーネントは `/generate-with-tests` で Vitest/Storybook/Playwright a11y を同梱 |
| IV. Security & RLS by Default | PASS | 新規 2 テーブルで RLS 有効化。`dives` に公開読み取りポリシー追加。`auth.uid()` は `(select auth.uid())` で包む。関数は `set search_path = ''`。非公開遮断を contracts のテストで全経路検証 |
| V. Accessibility | PASS | フォローボタン（`aria-pressed`/状態通知）、公開トグル（switch ロール）、タイムライン（リスト構造・空状態）、バディ一覧（リンク）を WCAG 2.1 AA で実装 |
| VI. Coding Standards | PASS | Feature-based（`social` 新設 + `dives` 拡張）、フォルダ構成は `rules/folder-structure.md`、snake_case/3NF/timestamptz（`sql.md`）、yup バリデーション |

**結果**: 違反なし。Complexity Tracking 不要。

## Project Structure

### Documentation (this feature)

```text
specs/021-buddy-follow-timeline/
├── plan.md              # 本ファイル
├── spec.md              # 要件（clarify 済み）
├── research.md          # Phase 0 出力
├── data-model.md        # Phase 1 出力（テーブル・RLS・関数）
├── quickstart.md        # Phase 1 出力（検証手順）
├── contracts/           # Phase 1 出力（Server Actions / RPC / クエリ / 検索パラメータの契約）
│   ├── follow-actions.md
│   ├── buddy-actions.md
│   ├── visibility-actions.md
│   ├── timeline-query.md
│   ├── public-dive-rpc.md
│   └── search-params.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root: `service-front/` + `supabase/`)

```text
supabase/migrations/
├── 20260630100000_create_dive_log_buddies.sql      # 中間テーブル + RLS + 自己バディ防止トリガ
├── 20260630100100_create_user_follows.sql          # フォロー関係 + RLS
├── 20260630100200_add_dives_public_read_policy.sql # 公開ログの authenticated 読み取り + タイムライン用 index
└── 20260630100300_create_get_public_dive_fn.sql    # 匿名共有用 SECURITY DEFINER 関数（20260701130000 で drop 済み）

service-front/src/
├── features/
│   ├── social/                         # 新規 feature（フォロー・タイムライン・公開プロフィール）
│   │   ├── types.ts
│   │   ├── index.ts
│   │   ├── server/
│   │   │   ├── queries.ts              # フォロー状態/件数・フォロー一覧・タイムライン・公開ログ一覧
│   │   │   └── actions.ts              # followUser / unfollowUser
│   │   ├── lib/
│   │   │   ├── timeline/               # タイムライン整形（rules/folder-structure 準拠）
│   │   │   └── mappers/                # 行→表示モデル変換
│   │   └── components/
│   │       ├── client/FollowButton/    # フォロー/解除トグル
│   │       └── server/
│   │           ├── Timeline/           # TOP 用タイムライン
│   │           ├── PublicProfile/      # プロフィール本体（公開ログ一覧・件数）
│   │           └── FollowCounts/       # フォロー/フォロワー件数
│   └── dives/                          # 既存 feature を拡張
│       ├── schemas/dive.schema.ts      # buddies[] / isPublic を追加
│       ├── server/{queries,actions}.ts # バディ取得・保存、公開トグル
│       ├── lib/
│       │   ├── buddies/                # バディ行マッパー・バリデーション（新規）
│       │   ├── search-params.ts        # buddy フィルタ追加
│       │   └── list-query.ts           # buddy 絞り込み追加
│       └── components/
│           ├── client/DiveBuddyField/  # バディ入力（ユーザー選択 + フリーテキスト）
│           ├── client/DiveVisibilityToggle/  # 公開/非公開トグル
│           └── server/DiveDetail/      # バディ一覧表示を追加
└── app/
    ├── page.tsx                        # TOP：タイムラインセクションを app 層で合成
    ├── (authenticated)/users/[slug]/page.tsx      # 公開プロフィール（フォロー・公開ログ）。034 でユーザー ID（handle）の URL 化（uuid は転送）
    # （2026-07-01 廃止）(public)/shared/dives/[slug]/page.tsx  ← 公開ログ閲覧は /dives/[id] に統合
```

> 注: `get_public_dive` 関数の migration（`20260630100300`）は US2（匿名共有）の独立性確保のため、tasks.md では US2 フェーズで作成する（構成図では他 3 本と並置しているが、適用は US2 着手時）。

**Structure Decision**: 既存の Feature-based 構成に従い、**フォロー／タイムライン／公開プロフィールは新規 `social` feature** に集約、**バディ記録・公開トグル・バディ検索は対象データを持つ `dives` feature の拡張**とする。feature 間 import は禁止のため、TOP ページ（app 層）で `social` のタイムラインと既存ダッシュボードを合成注入する（既存 `src/app/page.tsx` のパターンを踏襲）。匿名共有ページのみ `(public)` ルートグループに配置する。

## Design Detail

### 1. データモデル（詳細は data-model.md）

- **`dive_log_buddies`**: `dive_id`（FK→dives, cascade）/ `buddy_user_id`（FK→users, set null, nullable）/ `buddy_name`（freetext, nullable, ≤100）/ `removed_by_buddy`（boolean）。登録ユーザー or フリーテキストのいずれか一方を CHECK で強制。`(dive_id, buddy_user_id)` 部分ユニークで重複タグ防止。
- **`user_follows`**: PK `(follower_id, followee_id)`、`follower_id <> followee_id` の CHECK で自己フォロー防止、PK で重複防止。`followee_id` に index。
- **`dives`**: スキーマ変更なし（既存 `is_public` / `public_slug` を活用）。RLS に「公開ログ読み取り」を追加し、タイムライン用の部分 index を追加。

### 2. RLS（最重要・SC-002）

- `dive_log_buddies`: SELECT＝親 dive が閲覧可（所有者 or 公開）または自分宛タグ。INSERT＝dive 所有者のみ。UPDATE＝自分宛タグの `removed_by_buddy` 更新（本人除去）。DELETE＝dive 所有者かつ `removed_by_buddy=false`（本人除去済みは消せない＝再タグ付けブロック FR-024b）。
- `user_follows`: SELECT＝authenticated（件数・一覧表示）。INSERT＝`follower_id = (select auth.uid())`。DELETE＝同上。UPDATE なし。
- `dives`: 既存の本人 4 ポリシーに加え、`to authenticated using (is_public = true)` の公開読み取りを追加。匿名共有は RLS を広げず `get_public_dive(slug)` 関数経由。

### 3. フォロー（FR-012〜016）

- `followUser(followeeId)` / `unfollowUser(followeeId)` を Server Action 化。`follower_id` は `auth.uid()` 固定（クライアント値を信用しない）。自己フォロー・重複は DB 制約 + 事前チェックで弾く。
- フォロー状態・件数・一覧は `social/server/queries.ts` で取得。プロフィール（`/users/[slug]`。034 でユーザー ID の URL 化）と TOP で利用。

### 4. ログ公開/非公開（FR-007〜011）

- `DiveVisibilityToggle`（Client）から Server Action `setDiveVisibility(diveId, isPublic)` を呼ぶ。`is_public` を切り替えるだけ（slug は生成しない）。owner 限定（`.eq('user_id', …)` + 更新行数チェック）。非公開化時は閲覧経路を即遮断（RLS が `is_public=false` を弾くため `/dives/[id]` からも見えなくなる）。
- 公開中は共有リンク `{SITE_URL}/dives/[id]` を読み取り専用入力欄で提示し、直接コピーできる。
- 編集・削除・PDF 出力・公開設定は作成者本人のみ（`DiveDetail` の `canManage` 出し分け + `updateDive`/`deleteDive`/`setDiveVisibility` の owner チェック + 編集ページの owner ガード）。
- 新規ログ既定は `is_public=false`（既存 default）。フォームに公開チェックを追加。

### 5. バディ記録（FR-001〜006）

- `DiveBuddyField`（Client）で「登録ユーザー検索選択」＋「フリーテキスト追加」を 0..n 行で編集。`dive.schema.ts` に `buddies: { userId?: string; name?: string }[]` を追加（yup：どちらか一方必須、名前 ≤100）。
- 保存は Dive 保存 Action 内で `dive_log_buddies` を差分同期（既存 `buddy_name` 単一欄は移行：初期はフリーテキスト 1 件として併存表示、新規入力は中間テーブルへ）。
- `DiveDetail` にバディ一覧表示（登録ユーザーはプロフィールへのリンク = 034 以降ユーザー ID の URL、フリーテキストは素テキスト）。自己バディはトリガで防止。

### 6. タイムライン（FR-017〜021）

- `social/server/queries.ts` の `fetchTimeline({ limit, cursor })`：`dives` を `is_public=true` かつ `user_id in (フォロー中)` で `dive_date desc, id desc` のキーセット取得。RLS が二重防御。
- TOP（`src/app/page.tsx`）に `Timeline`（Server Component）を合成注入。空状態（フォロー 0／公開ログ 0）はフォロー導線を表示。件数上限 + 続き読み込み。

### 7. バディ検索（013 拡張・FR-022/023）

- `search-params.ts` に `buddy`（登録ユーザー ID）/ `buddyName`（フリーテキスト部分一致）を追加（contracts/search-params.md）。
- `list-query.ts` に `dive_log_buddies` の存在条件（`dive_id in (...)` または inner join）で絞り込みを追加。結果は既存 RLS により本人ログ＋閲覧可能な公開ログのみ（FR-023）。

### 8. 公開ログの閲覧（FR-010/011）※2026-07-01 改定

- 公開ログの閲覧は認証済みの `/dives/[id]` に統合する（当初の匿名共有ページ `/(public)/shared/dives/[slug]` と `get_public_dive` RPC は廃止）。
- `/dives/[id]` は `getDive`（RLS: 本人 or 公開ログ）で取得。閲覧者が作成者本人か（`dive.userId === user.id`）で `canManage` を出し分け、他人の公開ログでは編集・削除・公開設定・PDF を非表示にする。写真・同行バディは全項目表示。
- 未ログインは `(authenticated)` グループのため proxy/認証で `/login` へ誘導される（匿名閲覧は不可）。

## Phase 0: Research

未解決の技術論点を `research.md` に整理して決定する（バディ移行方針、公開ログの匿名アクセス手段、タイムラインのページング方式、フォロー状態の取得最適化、自己バディ防止の実装場所）。spec の [NEEDS CLARIFICATION] は specify フェーズで解消済み。

## Phase 1: Design & Contracts

`data-model.md`（テーブル・制約・RLS・トリガ・関数）、`contracts/*.md`（Server Actions / RPC / クエリ / 検索パラメータの入出力契約）、`quickstart.md`（マイグレーション適用と主要シナリオの検証手順）を生成。`.claude/CLAUDE.md` の SPECKIT マーカーを本 plan に更新。

## Complexity Tracking

> Constitution Check に違反なし。記載事項なし。
