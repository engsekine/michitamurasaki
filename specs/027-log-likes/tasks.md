# Tasks: ログのいいね機能

**Input**: Design documents from `specs/027-log-likes/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: constitution 原則 III（Test-First）に従い、Server Action / クエリ / lib は **Vitest 先行（実装前に失敗するテストを書く）**。コンポーネントは作成直後に `/generate-with-tests` でテスト類（Vitest / Storybook / Playwright a11y）を同梱する（プロジェクト規約）。

**Organization**: ユーザーストーリー単位でフェーズを分け、各ストーリーを独立して実装・検証できるようにする。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能（別ファイル・未完了タスクへの依存なし）
- **[Story]**: 対応するユーザーストーリー（US1 / US2 / US3）

## Path Conventions

- フロントエンド: `service-front/src/`（Feature-based。いいねは `features/social/` 所管 / plan.md R6）
- DB: `supabase/migrations/`（マイグレーション経由のみ）

---

## Phase 1: Setup（DB 基盤）

**Purpose**: いいねの保存先。US1 / US2 が依存する

- [X] T001 `dive_likes` テーブルのマイグレーションを作成する: `supabase/migrations/20260706100000_create_dive_likes.sql`（複合 PK・FK・インデックス 2 本・RLS 3 ポリシー・comment on。data-model.md §1 の定義どおり）
- [X] T002 ローカルへ適用し検証する: `SMTP_ENABLED=false npx supabase migration up` → `supabase db lint`。psql で RLS の挙動（自己いいね拒否 / 非公開ログ拒否）を quickstart.md シナリオ 1-5 の SQL で確認

**Checkpoint**: `dive_likes` に対して「他人の公開ログのみ INSERT できる」ことが DB 層で成立

---

## Phase 2: Foundational（型の拡張）

**Purpose**: US1 / US2 の両方が参照する型定義。ここを先に確定してから並行作業に入る

- [X] T003 `service-front/src/features/social/types.ts` に like 情報を追加する: `TimelineItem` へ `likeCount: number` / `likedByMe: boolean`、新規 `LikedDivesPage` 型（contracts/server-and-queries.md の型定義どおり）。既存の `TimelineItem` 生成箇所がコンパイルエラーになるため、`mapTimelineRow` 等に一時的な既定値（`likeCount: 0` / `likedByMe: false`）を入れて tsc を通す

**Checkpoint**: `npx tsc --noEmit` が通る。ここから US1〜US3 を並行で進められる

---

## Phase 3: User Story 1 - 公開ログへのいいね（付け外し・件数表示） (Priority: P1) 🎯 MVP

**Goal**: タイムラインとログ詳細で他人の公開ログにいいねを付け外しでき、件数といいね済み状態が表示される

**Independent Test**: ユーザー B が A の公開ログにいいね → 件数 +1・いいね済み表示、再操作で取り消し（quickstart.md シナリオ 1）

### Tests for User Story 1（実装より先に書き、失敗を確認する）

- [X] T004 [P] [US1] `likeDive` / `unlikeDive` の Vitest を先行作成: `service-front/src/features/social/server/actions.test.ts` に追加（成功 / 23505 冪等成功 / 42501 失敗文言 / 未ログイン失敗。既存 `followUser` テストのモックパターンを踏襲）
- [X] T005 [P] [US1] いいね集計 lib の Vitest を先行作成: `service-front/src/features/social/lib/likes/likes.test.ts`（dive ID 群 × 件数行 × 自分の行 → `likeCount`/`likedByMe` へのマージが正しい / 0 件・欠損の扱い）
- [X] T006 [P] [US1] `fetchDiveLikeState` と `fetchTimeline` 拡張の Vitest を先行作成: `service-front/src/features/social/server/queries.test.ts` に追加（バッチ 2 クエリの結合結果 / N+1 になっていないこと）

### Implementation for User Story 1

- [X] T007 [P] [US1] いいね集計 lib を実装する: `service-front/src/features/social/lib/likes/`（likes.ts + index.ts。T005 を green にする）
- [X] T008 [US1] Server Action を実装する: `service-front/src/features/social/server/actions.ts` に `likeDive` / `unlikeDive` を追加（`requireUser` ガード・23505 冪等変換・42501 文言変換・revalidatePath。T004 を green にする）
- [X] T009 [US1] クエリを実装する: `service-front/src/features/social/server/queries.ts` に `fetchDiveLikeState` を追加し、`fetchTimeline` へ like 情報のバッチ付加を組み込む（T003 の一時既定値を実データに置換。T006 を green にする）
- [X] T010 [US1] `LikeButton` を作成する: `service-front/src/features/social/components/client/LikeButton/LikeButton.tsx`（Props: `diveId`/`initialIsLiked`/`initialCount`。FollowButton と同型の楽観的 UI + ロールバック。`aria-pressed`/`aria-busy`/44px タッチターゲット。contracts/ui-and-routes.md の契約どおり）
- [X] T011 [US1] `/generate-with-tests service-front/src/features/social/components/client/LikeButton/LikeButton.tsx` を実行し、Vitest / Storybook / a11y テストを同梱する（Playwright は分類 D のため SKIP・Storybook addon-a11y でカバー）
- [X] T012 [US1] `Timeline` に組み込む: `service-front/src/features/social/components/server/Timeline/Timeline.tsx` の各項目へ LikeButton + 件数を追加（自分のログ項目は件数のみ）。`Timeline.test.tsx` / `Timeline.stories.tsx` を同期更新（テスト同期ルール）
- [X] T013 [US1] `DiveDetail` に `likeAction?: ReactNode` スロットを追加する: `service-front/src/features/dives/components/server/DiveDetail/DiveDetail.tsx`（既存アクションボタン群の並びに描画。social への import はしない）。`DiveDetail.test.tsx` を同期更新
- [X] T014 [US1] ログ詳細ページで注入する: `service-front/src/app/(authenticated)/dives/[id]/page.tsx` で `fetchDiveLikeState` を取得し、他人の公開ログには `<LikeButton>`、自分のログには件数表示のみを `likeAction` へ渡す

**Checkpoint**: quickstart.md シナリオ 1（1〜6）がすべて通る。US1 単独でデモ可能（MVP）

---

## Phase 4: User Story 2 - いいねしたログの一覧閲覧 (Priority: P2)

**Goal**: 専用ページ `/likes` でいいねしたログを新しい順に見返せる。導線はホームのタブ + ヘッダーナビの 2 箇所

**Independent Test**: 3 件いいね → 2 つの導線から同じ一覧が開き、新しい順に表示・詳細へ遷移できる（quickstart.md シナリオ 2）

### Tests for User Story 2（実装より先に書き、失敗を確認する）

- [X] T015 [P] [US2] `fetchLikedDives` の Vitest を先行作成: `service-front/src/features/social/server/queries.test.ts` に追加（created_at 降順 / keyset ページング nextCursor / 空 / 20 件ページサイズ）

### Implementation for User Story 2

- [X] T016 [US2] `fetchLikedDives` を実装する: `service-front/src/features/social/server/queries.ts`（`dive_likes` → `dives` JOIN・RLS による自動除外・`TimelineItem` 変換。T015 を green にする）
- [X] T017 [P] [US2] `TimelineTabs` を作成する: `service-front/src/features/social/components/server/TimelineTabs/TimelineTabs.tsx`（`active: 'timeline' | 'likes'`。`/` と `/likes` へのリンクタブ + `aria-current="page"`。contracts/ui-and-routes.md の契約どおり）
- [X] T018 [US2] `/generate-with-tests service-front/src/features/social/components/server/TimelineTabs/TimelineTabs.tsx` を実行し、テスト類を同梱する
- [X] T019 [US2] いいね一覧ページを作成する: `service-front/src/app/(authenticated)/likes/page.tsx`（`generatePageMetadata` + Header/Footer + `TimelineTabs(active='likes')` + 一覧表示 + 空状態「いいねしたログはありません」+ 追加読み込み。ページングは 025 通知一覧と同型のクライアント実装）
- [X] T020 [P] [US2] ホームにタブを設置する: `service-front/src/app/page.tsx` のタイムライン上部へ `TimelineTabs(active='timeline')` を追加
- [X] T021 [P] [US2] ヘッダーナビに「いいね」を追加する: `service-front/src/shared/components/layout/Header/Header.tsx`（`/likes`。ホーム・ダイビングログに続く 3 項目目）。`Header.test.tsx` / `Header.stories.tsx` を同期更新

**Checkpoint**: quickstart.md シナリオ 2（1〜7）がすべて通る。US1 + US2 が独立して動作

---

## Phase 5: User Story 3 - いいねされた通知 (Priority: P3)

**Goal**: いいねされたログ作成者にアプリ内通知が届く（集約・既読維持・設定 OFF 対応）

**Independent Test**: B がいいね → A に未読バッジ + 通知が表示され、タップでログ詳細へ遷移（quickstart.md シナリオ 3）

### Tests for User Story 3（実装より先に書き、失敗を確認する）

- [X] T022 [P] [US3] `notificationTarget` の Vitest を先行更新: `service-front/src/features/notifications/lib/notificationTarget/notificationTarget.test.ts` に `log_liked` → `/dives/[id]` の解決と消滅時フォールバックのケースを追加

### Implementation for User Story 3

- [X] T023 [US3] 通知種別追加のマイグレーションを作成する: `supabase/migrations/<ts>_add_log_liked_notification.sql`（`notifications` / `notification_preferences` の CHECK 制約 drop→再作成 + `notify_on_like()` トリガー。data-model.md §2 の定義どおり）
- [X] T024 [US3] ローカルへ適用し検証する: `SMTP_ENABLED=false npx supabase migration up` → `supabase db lint` → quickstart.md シナリオ 3-6 の SQL で集約 upsert / `read_at` 維持を確認
- [X] T025 [P] [US3] 通知定数を拡張する: `service-front/src/features/notifications/constants.ts` の `NotificationType` に `'log_liked'`、`NOTIFICATION_TYPE_LABELS` に「ログにいいねされたとき」、`NOTIFICATION_MESSAGES` に「{nickname} さんがあなたのログにいいねしました」を追加。constants を参照する既存テストを同期更新
- [X] T026 [US3] 遷移先解決を実装する: `service-front/src/features/notifications/lib/notificationTarget/` に `log_liked` → `/dives/{resource_id}`（消滅時フォールバックは buddy_tagged と同じ規則。T022 を green にする）
- [X] T027 [US3] 通知一覧・通知設定画面で `log_liked` が正しく表示・トグルできることを確認する（既存基盤が constants を列挙する実装なら追加コード不要。表示崩れ・型エラーがあれば `NotificationList` / `NotificationSettings` を修正 + テスト同期）

**Checkpoint**: quickstart.md シナリオ 3（1〜6）がすべて通る。全ストーリーが独立して動作

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T028 [P] quickstart.md の全シナリオ（1〜3）を通しで手動検証する（RLS・トリガー・導線・a11y の実機確認）※DB 層（シナリオ 1-5 の RLS / 3-6 のトリガー SQL）は psql で検証済み。ブラウザでの UI 通し確認のみ残り
- [X] T029 全体チェックを実行する: `npm run test --workspace service-front` / `npm run check --workspace service-front`（biome）/ `npx tsc --noEmit`（すべてパスさせる）
- [X] T030 [P] `/sync-spec` で `specs/027-log-likes/` と実装のずれを確認し、実装を真実として仕様書側を同期する

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1（Setup）**: 依存なし。最初に着手
- **Phase 2（Foundational）**: Phase 1 完了後。**全ストーリーをブロック**
- **Phase 3（US1）**: Phase 2 完了後
- **Phase 4（US2）**: Phase 2 完了後（US1 と並行可能。ただし T019 の一覧カード表現は T012 の Timeline 変更を再利用するため、先に US1 を終えると手戻りがない）
- **Phase 5（US3）**: Phase 1 完了後（DB 側は T001 のみに依存）。画面確認（T027）は US1 があるとやりやすい
- **Phase 6（Polish)**: 全ストーリー完了後

### User Story Dependencies

- **US1（P1）**: Foundational のみに依存。単独で MVP
- **US2（P2）**: Foundational に依存。US1 とはファイル競合（queries.ts / types.ts）があるため同一人物なら US1 → US2 の順が安全
- **US3（P3）**: DB は独立。UI 確認のみ US1 の画面を利用

### Within Each User Story

- テスト（Vitest 先行）→ lib → Server Action / クエリ → コンポーネント → ページ統合 の順
- コンポーネント作成直後に `/generate-with-tests`、既存コンポーネント変更時はテスト・story の同期更新（プロジェクト規約）

### Parallel Opportunities

- T004 / T005 / T006（US1 のテスト先行）は並列可
- T017（TimelineTabs）と T016(fetchLikedDives) は並列可。T020 / T021（導線 2 箇所）は並列可
- T022 / T025（US3 の通知定数・遷移先テスト）は並列可
- US3 の DB 側（T023-T024）は US1/US2 の実装と並行可能

---

## Parallel Example: User Story 1

```bash
# テスト先行フェーズ（3 つ並列）:
Task: "likeDive / unlikeDive の Vitest を actions.test.ts に追加"
Task: "いいね集計 lib の Vitest を lib/likes/likes.test.ts に作成"
Task: "fetchDiveLikeState / fetchTimeline 拡張の Vitest を queries.test.ts に追加"

# 実装フェーズ（lib は独立、actions / queries は types 確定後に並列）:
Task: "lib/likes を実装"
Task: "likeDive / unlikeDive を実装"
```

---

## Implementation Strategy

### MVP First（User Story 1 のみ）

1. Phase 1 → Phase 2 → Phase 3（US1）を完了
2. **STOP and VALIDATE**: quickstart シナリオ 1 で単独検証（いいねの付け外し・件数・三重防御）
3. この時点でデモ可能（タイムライン・ログ詳細でいいねが機能）

### Incremental Delivery

1. Setup + Foundational → 基盤完成
2. US1 → 単独検証 → MVP デモ
3. US2 → 単独検証（一覧 + 導線 2 箇所）
4. US3 → 単独検証（通知 + 集約 + 設定 OFF）
5. Polish（通し検証 + 全体チェック + 仕様同期）

---

## Notes

- タイムスタンプ `<ts>` は作成時点の `YYYYMMDDHHMMSS`（既存マイグレーションより新しいこと）
- ローカル Supabase は 025 の worktree 等と共有しているため、`db reset` / `migration up` の実行タイミングは他セッションと調整する（過去に衝突実績あり）
- コミットはタスクまたは論理グループ単位。コミット前に biome check（レビュー修正ルール）と `/sync-spec` を通す
