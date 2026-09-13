# Implementation Plan: ログのいいね機能

**Branch**: `027-log-likes` | **Date**: 2026-07-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/027-log-likes/spec.md`

## Summary

他ユーザーの公開ダイブログに「いいね」を付け外しできるようにし（P1）、いいねしたログを専用ページで見返せるようにし（P2）、いいねされたログ作成者へアプリ内通知を届ける（P3）。021（公開ログ・タイムライン）と 025（通知基盤）の上に載る薄いソーシャルレイヤー。

技術方針（research.md で確定）:

1. **いいねは `dive_likes` テーブル 1 つで表現**: `(user_id, dive_id)` 複合 PK で「1 人 1 ログ 1 回」（FR-003）を DB 制約として担保。件数は都度集計し、非正規化カラム（likes_count）は持たない（初期規模では不要。sql.md の導出値非保存の原則）
2. **公開範囲・自己いいね禁止は RLS で担保**: INSERT ポリシーの `with check` で「本人の行 × 公開中の他人のログ」のみ許可（FR-006 / FR-014）。UI 非表示と Server Action 検証に加えた三重防御（021 で確立済みの方針）
3. **通知は DB トリガーで生成**: `dive_likes` の INSERT に AFTER トリガーを張り、025 の `notify_on_follow` / `notify_on_buddy_tag` と同一パターン（security definer + 通知設定参照 + 集約 upsert + `read_at` 維持）で `log_liked` 通知を upsert する（FR-010〜012）
4. **楽観的 UI は FollowButton パターンの踏襲**: `useState` + `useTransition` + 失敗時ロールバック。タイムライン・ログ詳細の 2 箇所に同一の `LikeButton` を配置（Clarification Q2）
5. **いいね一覧は専用ページ `/likes`**: `dive_likes` → `dives` の JOIN（RLS が非公開化・削除済みを自動除外 = FR-009）を keyset ページングで取得し、タイムラインと同じ表示型（`TimelineItem`）に載せる。導線はホームのタブ切り替え + ヘッダーナビの 2 箇所（Clarification Q1）

## Technical Context

**Language/Version**: TypeScript（strict）/ Next.js App Router（React 19 + React Compiler）

**Primary Dependencies**: Supabase（`@supabase/ssr` + supabase-js）。フォームなし（ボタン操作のみ）のため React Hook Form 不要

**Storage**: Supabase PostgreSQL。新規テーブル `dive_likes`（RLS 必須）。通知種別 `log_liked` の追加（`notifications` / `notification_preferences` の CHECK 制約拡張）と生成トリガー 1 本（security definer / `set search_path = ''`）

**Testing**: Vitest（Server Action / クエリ / 集計変換ロジックの単体）、Storybook（新規 client コンポーネント）、Playwright + axe-core（a11y）。トリガー・RLS は quickstart.md の手動検証 + 既存 db-lint CI で担保（025 と同方式）

**Target Platform**: Web（service-front）。admin-front への変更なし

**Project Type**: Web アプリケーション（既存 Feature-based 構成への追加）

**Performance Goals**: いいね操作の反映 1 秒以内（SC-001。楽観的 UI で体感即時）。いいね一覧はいいね 100 件超でも初期表示が劣化しない（SC-005。keyset ページング 20 件/頁）。タイムライン 20 件分の件数・いいね済み状態は 1〜2 クエリのバッチで取得（N+1 禁止）

**Constraints**: リアルタイム同期なし（再読み込みで最新化。spec Edge Case）。いいね履歴は保持しない（取り消しで物理削除）。メール / プッシュ通知はスコープ外

**Scale/Scope**: 新テーブル 1 つ・新ページ 1 枚（/likes）・既存 2 画面への組み込み（タイムライン / ログ詳細）+ 通知種別 1 種追加。初期ユーザー規模は小

## Constitution Check

*GATE: Phase 0 前に通過必須。Phase 1 設計後に再評価。*

| 原則 | 判定 | 対応方針 |
|------|------|----------|
| I. Spec-Driven Development | PASS | spec → clarify（3 問確定済み）→ plan の順で進行 |
| II. Server Components First | PASS | いいね一覧ページ・タブ・件数表示は Server Component。Client は `LikeButton`（操作 + 楽観的 UI）の最小範囲のみ。`/likes` ページは `generatePageMetadata` を使用し Header/Footer を含める |
| III. Test-First（テスト同梱） | PASS | Server Action / クエリ / 変換ロジックは Vitest 先行。`LikeButton` は Vitest + Storybook + a11y 同梱（`/generate-with-tests`）。トリガー・RLS は quickstart 手動検証で代替（明記） |
| IV. Security & RLS by Default | PASS | `dive_likes` は RLS 有効。SELECT は「本人の行 or 閲覧可能なログの行」、INSERT は「本人 × 公開中の他人のログ」、DELETE は本人のみ（すべて `(select auth.uid())`）。トリガーは security definer + `set search_path = ''`。マイグレーション経由のみ |
| V. Accessibility（WCAG 2.1 AA） | PASS | `LikeButton` は `aria-pressed`（トグル状態）+ `aria-busy` + 件数を含むアクセシブルネーム（例: 「いいね 3 件、いいね済み」）。色だけに依存せずアイコン形状 + テキストで状態表現。タブ導線は `aria-current` 付きリンクで実装 |
| VI. Coding Standards | PASS | 既存 `features/social/` への追加（Feature-based）、snake_case / 3NF / timestamptz（sql.md）、コンポーネントフォルダ 3 点構成 + stories（folder-structure.md） |

**GATE 結果**: 違反なし。Complexity Tracking への記載は不要。

## Project Structure

### Documentation (this feature)

```text
specs/027-log-likes/
├── plan.md              # This file
├── research.md          # Phase 0 output（保存方式・通知生成・配置の決定）
├── data-model.md        # Phase 1 output（dive_likes / CHECK 拡張 / トリガー / RLS）
├── quickstart.md        # Phase 1 output（手動検証シナリオ）
├── contracts/           # Phase 1 output
│   ├── server-and-queries.md   # Server Action / クエリ契約
│   └── ui-and-routes.md        # 画面・ルート・導線マップ
└── tasks.md             # /speckit-tasks で作成（本コマンドでは作らない）
```

### Source Code (repository root)

```text
supabase/migrations/
├── <ts>_create_dive_likes.sql               # dive_likes + RLS + インデックス
└── <ts>_add_log_liked_notification.sql      # type CHECK 拡張（2 テーブル）+ notify_on_like トリガー

service-front/src/
├── features/social/                          # 既存 feature への追加（いいねはソーシャルレイヤー）
│   ├── components/
│   │   ├── client/
│   │   │   ├── LikeButton/                   # 新規: いいねトグル（楽観的 UI。FollowButton と同型）
│   │   │   └── LikedDivesList/               # 新規: いいね一覧本体（追加読み込み付き）
│   │   └── server/
│   │       ├── Timeline/                     # 変更: 各項目に LikeButton + 件数を表示
│   │       └── TimelineTabs/                 # 新規: 「タイムライン / いいねしたログ」タブ導線（/likes ページ用に残置）
│   │   ├── client/TimelineTabsSwitcher/      # feat/design-change で追加: TOP 内のインライン切替タブ（WAI-ARIA Tabs）
│   ├── server/
│   │   ├── actions.ts                        # 追加: likeDive / unlikeDive / loadMoreLikedDives
│   │   └── queries.ts                        # 追加: fetchLikedDives（keyset）/ fetchDiveLikeState
│   │                                         # 変更: fetchTimeline に likeCount / likedByMe を付加
│   ├── lib/likes/                            # 新規: いいね状態のバッチ集計・行変換
│   └── types.ts                              # 変更: TimelineItem に like 情報、LikedDivesPage 追加
├── features/notifications/
│   ├── constants.ts                          # 変更: NotificationType に 'log_liked' + ラベル / 文言
│   └── lib/notificationTarget/               # 変更: log_liked → /dives/[id]（消滅時フォールバック）
├── features/dives/components/server/DiveDetail/  # 変更: likeAction スロット（ReactNode）を追加
├── app/page.tsx                              # 変更: TimelineTabsSwitcher を設置（feat/design-change で TimelineTabs から置き換え。いいね一覧もその場に表示）
├── app/(authenticated)/likes/page.tsx        # 新規: いいねしたログ一覧ページ
├── app/(authenticated)/dives/[id]/page.tsx   # 変更: 他人の公開ログに LikeButton を注入
└── shared/components/layout/Header/          # 変更: ナビに「いいね」項目を追加
```

**Structure Decision**: いいねはフォロー・タイムラインと同じソーシャルレイヤーの操作なので、新 feature を切らず既存 `features/social/` に追加する。`DiveDetail`（features/dives）から social への cross-feature import を避けるため、`DiveDetail` には `likeAction?: ReactNode` スロットを追加し、app 層（`dives/[id]/page.tsx`）で `LikeButton` を注入して合成する（`app/` → `features/` の依存方向を維持）。通知は 025 の既存 feature に種別を 1 つ追加する位置づけで、DB 生成トリガーはマイグレーション所管。admin-front は変更しない。

## Complexity Tracking

Constitution Check 違反なしのため記載事項なし。
