---
description: "Task list for バディ・フォロー・タイムライン（ソーシャル機能）"
---

# Tasks: バディ・フォロー・タイムライン（ソーシャル機能）

**Input**: Design documents from `specs/021-buddy-follow-timeline/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: 本プロジェクトは constitution III（Test-First）に従い**テストを含む**。新規 lib は Vitest 先行、新規コンポーネントは `/generate-with-tests` で Vitest/Storybook/Playwright a11y を同梱する。

**Organization**: タスクはユーザーストーリー単位（US1〜US5）に編成し、各ストーリーを独立して実装・検証できるようにする。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可（別ファイル・依存なし）
- **[Story]**: US1〜US5（spec.md のユーザーストーリーに対応）
- ファイルパスを明記

## Path Conventions

- フロント: `service-front/src/...`（Feature-based、`rules/folder-structure.md` 準拠）
- DB: `supabase/migrations/...`（マイグレーション経由のみ）

---

## Phase 1: Setup

**Purpose**: 雛形とディレクトリ準備

- [X] T001 `social` feature の雛形を作成（`service-front/src/features/social/` 配下に `index.ts` / `types.ts` と空の `server/`・`lib/`・`components/{client,server}/`）
- [X] T002 [P] `dives` feature 拡張用ディレクトリを用意（`service-front/src/features/dives/lib/buddies/`）

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 全ストーリーが依存する DB スキーマ・RLS・型。⚠️ ここが完了するまで US 実装は開始不可

- [X] T003 マイグレーション作成 `supabase/migrations/20260630100000_create_dive_log_buddies.sql`：中間テーブル + CHECK（排他・名前長）+ 部分ユニーク + index + 自己バディ防止トリガ `prevent_self_buddy` + RLS 4 ポリシー（data-model.md §1）
- [X] T004 マイグレーション作成 `supabase/migrations/20260630100100_create_user_follows.sql`：自己参照フォロー関係 + PK + 自己フォロー CHECK + `idx_user_follows_followee_id` + RLS 3 ポリシー（data-model.md §2）
- [X] T005 マイグレーション作成 `supabase/migrations/20260630100200_add_dives_public_read_policy.sql`：`authenticated` 公開読み取りポリシー + `idx_dives_public_user_date` 部分 index（data-model.md §3）
- [X] T006 退会フォールバックトリガ `handle_buddy_user_deleted` を `20260630100000_create_dive_log_buddies.sql` に追加（`users` 削除時、当該ユーザーを指す `dive_log_buddies` 行の `buddy_user_id` を NULL にし、その時点の nickname を `buddy_name` へ退避して CHECK 整合を保つ。`set search_path=''`）（data-model.md §1 注記）
- [X] T007 [P] `@repo/supabase` の Database 型を再生成し、新テーブル（`dive_log_buddies` / `user_follows`）を型に反映（`packages/supabase`）
- [X] T008 [P] `service-front/src/features/social/types.ts` に共有表示モデル型を定義（`DiveBuddy` / `FollowState` / `TimelineItem` / `PublicProfile` / カーソル型）（data-model.md §5）

**Checkpoint**: スキーマ・RLS・型が整い、各ユーザーストーリーの実装を開始できる

---

## Phase 3: User Story 1 - 同行バディをログに記録・表示する (Priority: P1) 🎯 MVP

**Goal**: ダイブログに同行バディ（登録ユーザー／フリーテキスト）を複数記録し、詳細で一覧表示・プロフィール遷移できる

**Independent Test**: ログ編集でバディを追加・保存 → 詳細で一覧表示・登録ユーザーは `/users/[id]` 遷移・自己タグ不可を確認

### Tests for User Story 1 ⚠️（先に書いて落ちることを確認）

- [X] T009 [P] [US1] バディ行マッパーの単体テスト `service-front/src/features/dives/lib/buddies/buddy-mapper.test.ts`（row→DiveBuddy、nickname 解決、freetext/登録の区別）
- [X] T010 [P] [US1] バディ yup バリデーションのテストを `service-front/src/features/dives/schemas/dive.schema.test.ts` に追加（どちらか一方必須・名前 ≤100・自己除外）
- [X] T011 [P] [US1] 退会フォールバックの回帰テスト：登録ユーザーのバディがいる dive で当該ユーザーを削除 → バディが nickname のフリーテキストとして残り、表示が壊れないことを確認（ローカル実 DB で検証済み）

### Implementation for User Story 1

- [X] T012 [US1] `service-front/src/features/dives/schemas/dive.schema.ts` に `buddies: { userId?; name? }[]` と yup ルールを追加
- [X] T013 [P] [US1] バディ行マッパー `service-front/src/features/dives/lib/buddies/buddy-mapper.ts` を実装
- [X] T014 [US1] `service-front/src/features/dives/server/queries.ts` に dive のバディ取得（詳細・編集用、`removed_by_buddy=false`）を追加
- [X] T015 [US1] `service-front/src/features/dives/server/actions.ts` の Dive 保存にバディ差分同期を実装（追加=INSERT/削除=DELETE、自己・重複・本人除去済み再タグを拒否）（contracts/buddy-actions.md）
- [X] T016 [US1] `removeBuddyTagOfSelf(buddyTagId)` Server Action を `service-front/src/features/social/server/actions.ts` に実装（本人除去 FR-024a、RLS "buddy can opt out own tag"）
- [X] T017 [P] [US1] `DiveBuddyField` クライアントコンポーネントを作成（`service-front/src/features/dives/components/client/DiveBuddyField/`：登録ユーザー選択 + フリーテキスト 0..n 行）→ 作成後 `/generate-with-tests` 実行
- [X] T018 [US1] `service-front/src/features/dives/components/server/DiveDetail/DiveDetail.tsx` にバディ一覧表示を追加（登録は `/users/[id]` リンク・freetext は素テキスト）。**既存の単一 `dives.buddy_name`（レガシー）も同一バディ欄に併存表示する**こと。`DiveDetail.test.tsx`/`.stories.tsx` を同期更新
- [X] T019 [US1] DiveForm（`service-front/src/features/dives/components/client/DiveForm/`）に `DiveBuddyField` を組み込み、`useDiveFormSubmit` で buddies を送信

**Checkpoint**: US1 単独で「誰と潜ったか」の記録・表示が機能する（MVP）

---

## Phase 4: User Story 2 - ログの公開・非公開を切り替える (Priority: P2)

**Goal**: 各ログの公開/非公開を切り替え、公開は共有リンク＋認証ユーザーに見え、非公開化で即遮断される

**Independent Test**: 1 本を公開→別アカウント/匿名リンクで閲覧可→非公開化→全経路で不可（5 秒以内）

### Tests for User Story 2 ⚠️

- [X] T020 [P] [US2] `setDiveVisibility` の権限・slug 生成・非公開化ロジックの単体テスト（`service-front/src/features/dives/server/` 配下）
- [X] T021 [P] [US2] `get_public_dive` の公開条件テスト（`is_public=false`/未知 slug は 0 行）を DB テスト or クエリテストで追加（ローカル実 DB・anon ロールで検証済み）

### Implementation for User Story 2

- [X] T022 [US2] マイグレーション作成 `supabase/migrations/20260630100300_create_get_public_dive_fn.sql`（SECURITY DEFINER・`set search_path=''`・anon/authenticated に grant）（data-model.md §4 / contracts/public-dive-rpc.md）
- [X] T023 [US2] `service-front/src/features/dives/server/actions.ts` に `setDiveVisibility(diveId, isPublic)` を実装（公開化で `public_slug` 生成、非公開化で遮断、revalidate）（contracts/visibility-actions.md）
- [X] T024 [P] [US2] `DiveVisibilityToggle` クライアントコンポーネント作成（`service-front/src/features/dives/components/client/DiveVisibilityToggle/`：`role="switch"`・`aria-checked`）→ `/generate-with-tests`
- [X] T025 [US2] DiveForm（新規既定 非公開）と DiveDetail に公開設定 UI を組み込み、関連テスト・story を同期更新
- [X] T026 [US2] 匿名共有ページ `service-front/src/app/(public)/shared/dives/[slug]/page.tsx` を作成（`get_public_dive` 取得、非公開/不明 slug は 404、`generatePageMetadata` で OGP）

**Checkpoint**: US1 と US2 が独立して機能（公開制御が安全に動く）

---

## Phase 5: User Story 3 - フォロー／解除と相手の公開ログ閲覧 (Priority: P2)

**Goal**: 承認不要の一方向フォロー／解除、フォロー中相手の公開ログ閲覧、フォロー/フォロワーの件数・一覧表示

**Independent Test**: A→B フォローで件数・一覧が更新・B の公開ログのみ閲覧・解除で復元・自己/二重フォロー不可

### Tests for User Story 3 ⚠️

- [X] T027 [P] [US3] `followUser`/`unfollowUser` の冪等性・自己/重複拒否の単体テスト（`service-front/src/features/social/server/actions.test.ts`）
- [X] T028 [P] [US3] `fetchFollowState` 集約クエリ（isFollowing/follower/following 件数）の単体テスト（`service-front/src/features/social/server/queries.test.ts`）
- [X] T029 [P] [US3] `fetchFollowLists`（following / followers 一覧・ページング）の単体テスト（`service-front/src/features/social/server/queries.test.ts`）

### Implementation for User Story 3

- [X] T030 [US3] `service-front/src/features/social/server/actions.ts` に `followUser`/`unfollowUser` を実装（`follower_id=auth.uid()` 固定・冪等・revalidate）（contracts/follow-actions.md）
- [X] T031 [US3] `service-front/src/features/social/server/queries.ts` に `fetchFollowState` と `fetchUserPublicDives` を実装（contracts/timeline-query.md）
- [X] T032 [US3] `service-front/src/features/social/server/queries.ts` に `fetchFollowLists(userId, kind: 'following' | 'followers', { limit, cursor })` を実装（`user_follows` × `user_details.nickname` 結合、キーセット）
- [X] T033 [P] [US3] `FollowButton` クライアントコンポーネント作成（`service-front/src/features/social/components/client/FollowButton/`：`aria-pressed`・状態通知）→ `/generate-with-tests`
- [X] T034 [P] [US3] `FollowCounts` サーバーコンポーネント作成（`service-front/src/features/social/components/server/FollowCounts/`）→ `/generate-with-tests`
- [X] T035 [P] [US3] `FollowList` サーバーコンポーネント作成（`service-front/src/features/social/components/server/FollowList/`：各行 nickname + `FollowButton`）→ `/generate-with-tests`
- [X] T036 [P] [US3] `PublicProfile` サーバーコンポーネント作成（`service-front/src/features/social/components/server/PublicProfile/`：公開ログ一覧 + フォロー UI 合成）→ `/generate-with-tests`
- [X] T037 [US3] プロフィールページ `service-front/src/app/(authenticated)/users/[id]/page.tsx` を作成（`PublicProfile` 合成、`generatePageMetadata`）
- [X] T038 [US3] フォロー/フォロワー一覧ページ `service-front/src/app/(authenticated)/users/[id]/following/page.tsx` と `.../followers/page.tsx` を作成（`FollowList` 合成、`generatePageMetadata`）

**Checkpoint**: US1〜US3 が独立して機能（つながりが成立）

---

## Phase 6: User Story 4 - TOP ページのタイムライン (Priority: P3)

**Goal**: TOP にフォロー中ユーザーの公開ログを新しい順で表示、詳細遷移、空状態

**Independent Test**: 複数フォロー先の公開ログが新しい順・最大20件で表示、非公開は混ざらない、空状態が出る

### Tests for User Story 4 ⚠️

- [X] T039 [P] [US4] `fetchTimeline` のキーセット・非公開除外・フォロー集合フィルタの単体テスト（`service-front/src/features/social/server/queries.test.ts`）
- [X] T040 [P] [US4] タイムライン整形ユーティリティの単体テスト `service-front/src/features/social/lib/timeline/`

### Implementation for User Story 4

- [X] T041 [US4] `service-front/src/features/social/server/queries.ts` に `fetchTimeline({limit=20,cursor})` を実装（`is_public=true` × フォロー集合、`dive_date desc,id desc` キーセット）（contracts/timeline-query.md）
- [X] T042 [P] [US4] タイムライン整形ユーティリティ `service-front/src/features/social/lib/timeline/`（行→`TimelineItem`、空判定）を実装
- [X] T043 [P] [US4] `Timeline` サーバーコンポーネント作成（`service-front/src/features/social/components/server/Timeline/`：リスト構造・空状態・続き読み込み）→ `/generate-with-tests`
- [X] T044 [US4] TOP `service-front/src/app/page.tsx` にタイムラインセクションを app 層で合成注入（既存ダッシュボードと並置、`Timeline` を `social` から注入）

**Checkpoint**: US1〜US4 が独立して機能（フィードが見える）

---

## Phase 7: User Story 5 - 検索でバディから絞り込む（013 拡張）(Priority: P3)

**Goal**: ダイブ検索にバディ（登録ユーザー／フリーテキスト名）絞り込みを追加、閲覧権限内のみ返す

**Independent Test**: `?buddy=<userId>` / `?buddy_name=...` で該当ログのみ返り、権限外は出ない、除去済みタグはヒットしない

### Tests for User Story 5 ⚠️

- [X] T045 [P] [US5] `parseDiveFilter`/`filterToSearchParams` の buddy/buddy_name パーステストを `service-front/src/features/dives/lib/search-params.test.ts` に追加
- [X] T046 [P] [US5] `list-query` のバディ絞り込みテストを `service-front/src/features/dives/lib/list-query.test.ts` に追加

### Implementation for User Story 5

- [X] T047 [US5] `service-front/src/features/dives/lib/search-params.ts` に `buddy`(uuid)/`buddy_name`(≤100) を追加（parse/toParams/`FILTER_KEYS`/`isSameFilter` 更新）（contracts/search-params.md）
- [X] T048 [US5] `service-front/src/features/dives/lib/list-query.ts` にバディ絞り込みを追加（`dive_id in (select … from dive_log_buddies where … removed_by_buddy=false)`）
- [X] T049 [US5] `DiveSearchBar`（`service-front/src/features/dives/components/client/DiveSearchBar/`）にバディ条件 UI を追加し、テスト・story を同期更新

**Checkpoint**: 全ユーザーストーリーが独立して機能

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 横断的な品質確保

- [X] T050 [P] 非公開遮断の RLS 全経路テスト（直URL / タイムライン / 公開ログ一覧 / フォロー一覧 / 検索 / 匿名共有）を追加し、非公開・他人ログが漏れないことを確認（SC-002）（ローカル実 DB・owner/他人/anon の各ロールで検証済み）
- [X] T051 [P] a11y 検証（`FollowButton`/`DiveVisibilityToggle`/`Timeline`/`DiveBuddyField`/`FollowList`）を Playwright + axe-core で確認（WCAG 2.1 AA）（`service-front/tests/a11y/social-pages.spec.ts`。021 コンポーネントは違反なし。詳細ページ全体に残る `packages/ui` destructive Button のコントラスト不足は spec 012 由来・本機能対象外）
- [X] T052 `specs/021-buddy-follow-timeline/quickstart.md` のシナリオ S1〜S6 を検証（S1/S2 は E2E 自動化 `service-front/tests/social-flows.spec.ts`、S2 は匿名共有→非公開化 404 まで確認＝SC-002 安全側。S3〜S6 はローカル実 DB での RLS/トリガ検証（T011/T021/T050）とフォロー UI の単体/Story で担保）
- [X] T053 [P] `/sync-spec` で spec とのズレ確認・`/code-fix` でコード規約準拠を確認

### 追加実装（実装中に判明・spec.md「実装メモ」に反映済み）

- [X] T054 ユーザー検索・フォロー導線を追加: `search_users_by_nickname` 関数（§4c）+ `searchUsers`（`social/server/queries.ts`）+ `/users/search` ページ + `UserSearchBar` + `AuthNav` の「マイプロフィール」「ユーザーを探す」導線
- [X] T055 `user_details.nickname` の一意制約と `is_nickname_taken` 関数を追加（`20260701110000_...`・§4d）。`signUp`/`completeProfile`/`updateProfile` に事前チェックを組み込み
- [X] T056 日付 CHECK 制約の JST 統一（`20260701090000_...`・§4e）。JST 早朝に「今日」を保存できない不具合を横断修正

### レビュー指摘対応（develop マージ前レビュー）

- [X] T057 `setDiveVisibility` に owner 限定（`.eq('user_id', …)`）+ 更新行数チェックを追加し、他人/存在しない id への誤成功応答を防止
- [X] T058 バディ同期の失敗を握りつぶさず伝播（`syncDiveBuddies` が成否を返し、`createDive`/`updateDive` が `buddyWarning` を返却→フォームで表示）。`list-query` のバディ絞り込みもエラー時に throw
- [X] T059 `fetchTimeline` のフォロー先を直近 `MAX_TIMELINE_FOLLOWEES=1000` 件に絞り、IN 句肥大化を防止（FR-021）。`fetchFollowLists` の動的キー unsafe cast を kind 分岐で解消
- [X] T060 `DiveBuddyField` の登録済みバディを nickname 表示に修正（schema に表示専用 `nickname` を追加）。`formatJstDate`（`shared/lib/date`）を共通化し 3 箇所の重複を統合。共有リンクのコピーボタン追加＋`bg-muted` 上のコントラスト（WCAG AA）を修正
- [X] T061 `DiveVisibilityToggle` の共有リンクを完全な絶対 URL（`SITE_URL` 基準）で読み取り専用入力欄に表示し、直接選択・コピー可能にする（`window.location.origin` 依存を廃止）。契約: contracts/visibility-actions.md「共有リンクの提示（UI）」

### 2026-07-01 改定（匿名共有廃止・/dives/[id] 統合・作成者のみ編集削除）

- [X] T062 他人の公開ログが「自分のログ一覧」「最近のダイブログ」等に混ざる不具合を修正。公開読み取り RLS 依存だった本人限定クエリに `user_id` 明示フィルタを追加（`fetchDiveListPage` / `getLatestDiveNumber` / `listDiveOptions` / `fetchDivesForExport`（`ownerId`）/ dashboard `getPrimaryRegulatorStatus`・`getDashboardHero`）
- [X] T063 編集・削除・公開設定・PDF 出力を作成者本人のみに制限。`DiveDetail` を `canManage` で出し分け、`/dives/[id]/edit` に owner ガード（`notFound`）、`updateDive`/`deleteDive` に owner 二重防御（`.eq('user_id', …)` + 行数チェック）
- [X] T064 匿名共有ページ `/(public)/shared/dives/[slug]` と `get_public_dive` RPC を廃止（`20260701130000_drop_get_public_dive_fn.sql`）。公開ログ閲覧を `/dives/[id]` に統合。`setDiveVisibility` の slug 生成を廃止し `is_public` のみ更新。`DiveVisibilityToggle` の共有 URL を `{SITE_URL}/dives/[id]` に変更。未使用の `lib/visibility` を削除
- [X] T065 spec.md / plan.md / data-model.md / contracts / quickstart / Playwright（`tests/social-flows.spec.ts` S2）を上記改定に同期

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)**: 依存なし
- **Foundational (P2)**: Setup 後。全 US をブロック（特に T003〜T006 のマイグレーション・T007 型再生成）
- **User Stories (P3〜P7)**: Foundational 後に開始可。US 間は独立（並列可）。優先度順は P1→P2→P2→P3→P3
- **Polish (P8)**: 対象 US 完了後

### User Story Dependencies

- **US1（P1）**: Foundational（T003 dive_log_buddies・T006 退会トリガ・T007 型）後。他 US 非依存
- **US2（P2）**: Foundational（T005 公開ポリシー）後。T022 関数は US2 内
- **US3（P2）**: Foundational（T004 user_follows）後。US2 の公開制御と組み合わさるが独立テスト可
- **US4（P3）**: Foundational（T004/T005）後。US3 のフォローと US2 の公開を前提に「見える」が、クエリは独立実装・テスト可
- **US5（P3）**: Foundational（T003）後。US1 のバディ記録が入っていると実データ検証しやすいが、絞り込みロジックは独立

### Within Each User Story

- テストを先に書いて落とす → マッパー/バリデーション → クエリ/アクション → コンポーネント → ページ合成
- コンポーネント新規作成直後に `/generate-with-tests`

### Parallel Opportunities

- T007 / T008 は並列（型再生成・型定義）
- 各 US の `[P]` テスト（別ファイル）は並列
- マイグレーション T003/T004/T005 は別ファイルだが、T006 は T003 と同一ファイルのため T003 の後（適用順と型再生成のため Foundational 内で一括レビュー推奨）
- Foundational 完了後、US1〜US5 を別担当で並列可

---

## Parallel Example: User Story 1

```bash
# US1 のテストを先に並列で書く（別ファイル）:
Task: "バディ行マッパーのテスト service-front/src/features/dives/lib/buddies/buddy-mapper.test.ts"
Task: "バディ yup バリデーションのテスト service-front/src/features/dives/schemas/dive.schema.test.ts"
Task: "退会フォールバックの回帰テスト"

# 実装の並列可能タスク:
Task: "buddy-mapper.ts 実装"
Task: "DiveBuddyField コンポーネント作成（/generate-with-tests）"
```

---

## Implementation Strategy

### MVP First（US1 のみ）

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1（T001〜T019）→ 独立検証（バディ記録・表示）→ デモ可

### Incremental Delivery

1. Setup + Foundational → 基盤完成
2. US1（バディ記録）→ 検証 → MVP
3. US2（公開制御）→ 検証
4. US3（フォロー）→ 検証
5. US4（タイムライン）→ 検証
6. US5（バディ検索）→ 検証
7. Polish（RLS 全経路・a11y・quickstart・sync）

### Parallel Team Strategy

Foundational 完了後、US1/US2/US3 を別担当で並行。US4 は US2/US3 のクエリ確定後に合流、US5 は US1 のスキーマ確定後に着手。

---

## Notes

- [P] = 別ファイル・依存なし。[Story] ラベルでトレーサビリティ確保
- 各 US は独立して完了・検証可能
- 実装前にテストが落ちることを確認（constitution III）
- マイグレーションは追記のみ・`set search_path=''`・`(select auth.uid())` 包み必須（constitution IV / rules/sql.md）
- 新規コンポーネント作成直後は `/generate-with-tests`、既存編集時はテスト・story を同期
- 各タスク／論理単位ごとにコミット（Conventional Commits）
