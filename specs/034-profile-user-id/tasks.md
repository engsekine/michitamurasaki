# Tasks: ユーザー ID とプロフィール URL（Rev.2）

**Input**: Design documents from `/specs/034-profile-user-id/`

**Prerequisites**: plan.md, spec.md（Rev.2）, research.md, data-model.md, contracts/routes-and-resolution.md, quickstart.md

**Tests**: schema・profile-path・解決・actions は Vitest 先行。E2E は `tests/profile-url.spec.ts` を handle 版に改訂。

**Organization**: US1/US2（登録・形式・URL・導線）は密結合のため同一フェーズで実装し、US3（変更）を後続フェーズとする。

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Rev.1 マイグレーション `supabase/migrations/20260712100000_create_get_user_id_by_nickname_fn.sql` を削除し、`supabase/migrations/<ts>_add_user_handle.sql` を作成する（drop 旧 RPC → handle 列追加 → backfill → NOT NULL/CHECK/一意 → handle_new_user 更新 → get_user_id_by_handle / is_handle_taken / get_user_public_profiles 拡張。すべて revoke → grant。data-model.md の SQL 参照）。稼働 DB に適用し、`packages/supabase/src/types.ts` を更新する（handle 列・RPC 2 本・profiles 戻り値）

---

## Phase 2: Foundational

- [X] T002 `service-front/src/shared/lib/profile-path/` を Rev.2 に改訂（**テスト先行**）: `HANDLE_PATTERN` / `isValidHandle`（形式 + 予約語）/ `normalizeHandle` / `profilePath({ userId, handle })`。Rev.1 の nickname 系（isUrlSafeNickname / NICKNAME_FORBIDDEN_PATTERN）は削除
- [X] T003 `service-front/src/shared/schemas/user-profile.ts`: nickname の Rev.1 禁則を撤去し、`handle` フィールド（必須・transform 小文字化・形式・予約語）を追加（**テスト先行**。user-profile.test の Rev.1 禁則テストを handle テストに置換）
- [X] T004 `service-front/src/features/social/server/queries.ts` を Rev.2 に改訂（**テスト先行**）: `resolveNicknames` → `resolveProfiles`（nickname + handle の Map）、`resolveUserIdByNickname` → `resolveUserIdByHandle`（正規化して RPC）、`resolveProfileSlug`（uuid → handle URL 転送 / handle 解決）、`fetchPublicProfile` に handle 追加。`PublicProfile` 型に handle

**Checkpoint**: 判定・解決・schema が handle 版で揃う

---

## Phase 3: User Story 1+2 - 登録・形式・URL・導線 (Priority: P1) 🎯 MVP

**Independent Test**: quickstart シナリオ 1・2・4

- [X] T005 [US1] サインアップ: `features/auth` の `SignUpInput`・`signUp`（meta に handle・`is_handle_taken` 事前チェック）・`SignupForm`（「ユーザー ID」必須欄 + 説明文）を追加し、actions / form のテストを同期する
- [X] T006 [US1] Google 補完: `completeProfile`（INSERT に handle・事前チェック・成功時 `auth.updateUser({ data: { handle } })`）・`ProfileCompletionForm` に欄追加。テスト同期
- [X] T007 [US1] 導線の handle 化: 型配管（`FollowUser.handle` / `TimelineItem.ownerHandle` / いいね一覧 / `NotificationItem.actorHandle` / `DiveBuddy.handle` / `PublicProfile.handle`）と各コンポーネント（Timeline・FollowList・FollowCounts・LikedDivesList・DiveDetail バディ・notificationTarget・AuthNav = metadata.handle）を profilePath({ userId, handle }) に差し替える。表示名は nickname のまま。全テスト・stories を同期
- [X] T008 [US1] `users/[slug]/` 3 ページ: requireProfileBySlug 経由のまま canonical / Breadcrumbs が handle URL になることを確認・調整
- [X] T009 [US1] `supabase/seed.sql.template` の各テストユーザー meta に handle（taro / buddy-taro / rename-saburo / admin-ops）を追加し、稼働 DB の該当ユーザーにも反映する
- [X] T010 [US1] E2E `service-front/tests/profile-url.spec.ts` を handle 版に改訂: handle URL 表示・大文字 URL の解決・ヘッダー導線・followers/following・404・uuid 転送（quickstart シナリオ 2）+ サインアップの形式/重複エラー（シナリオ 1 は schema/form 単体テストで代替可の範囲を明記）

**Checkpoint**: 登録から URL・全導線まで handle で機能する（MVP）

---

## Phase 4: User Story 3 - ユーザー ID の変更 (Priority: P2)

**Independent Test**: quickstart シナリオ 3

- [X] T011 [US3] `features/account`: `UpdateProfileInput`・`updateProfile`（handle 更新・`is_handle_taken(p_exclude_user_id)` 事前チェック・一意制約フォールバック・成功時 metadata 同期 = Rev.1 の nickname 同期を置換）・`ProfileEditForm` に欄追加。テスト同期
- [X] T012 [US3] E2E 追記: rename ユーザーで handle 変更 → 新 URL・旧 URL 404・uuid 転送追随・後始末（Rev.1 の US3 テストを handle 版に改訂）

---

## Phase 5: Polish

- [X] T013 [P] 全体検証: `npx tsc --noEmit`・`npx biome check`・`npx vitest run --project unit`・`npx playwright test tests/profile-url.spec.ts` + social 回帰（social-flows / a11y は単独実行で確認）
- [X] T014 [P] quickstart シナリオ 1〜5 の確認（自動化済み範囲の対応表を実装メモに記録）
- [X] T015 既存仕様書の同期: 021/025 の Rev.1 追記（ニックネーム URL）を handle 表現に更新。034 spec/contracts と実装の最終突合

---

## 実装メモ（034 Rev.2 実装セッション / 2026-07-12）

T001〜T015 全タスク完了。develop（033 マージ後）を取り込んだうえで Rev.1 実装を handle 版に置換した。

**検証（すべて green）**
- `npx tsc --noEmit` / `npx biome check .`: エラー 0
- `npx vitest run --project unit`: 1461 passed（handle 形式・解決・schema・metadata 同期・全導線のリンク）
- `npx playwright test tests/profile-url.spec.ts`: **8 passed**（handle URL・大文字解決・ヘッダー導線・followers/following・404・uuid 転送・変更フロー一式・形式/予約語/重複の拒否）

**Rev.1 からの主な置換**
- profile-path: isUrlSafeNickname / NICKNAME_FORBIDDEN_PATTERN → HANDLE_PATTERN / isValidHandle / normalizeHandle
- RPC: get_user_id_by_nickname（削除・drop）→ get_user_id_by_handle + is_handle_taken。get_user_public_profiles / search_users_by_nickname は handle 返却に拡張
- nickname の URL 禁則は撤去（表示名の役割に戻す = FR-010）
- 全導線の profilePath は handle 引数に置換（表示は nickname のまま）。NotificationItem.actorHandle / FollowUser.handle / TimelineItem.ownerHandle / DiveBuddy.handle を配管

**運用ノート**
- 稼働 DB には backfill + フレンドリー handle（taro / buddy-taro / rename-saburo / admin-ops）と auth metadata を手動反映済み。`db reset` 時は seed テンプレートの meta から同じ値になる
- E2E 初回はコールドコンパイルで beforeEach ログインが 30 秒を超えることがある（再実行で解消。既知の傾向）

---

## Dependencies

- Phase 1 → Phase 2（T002/T003/T004 は T001 の型更新後。T002 と T003/T004 は並列可）→ Phase 3（T005/T006/T007 並列可 → T008〜T010）→ Phase 4 → Phase 5
