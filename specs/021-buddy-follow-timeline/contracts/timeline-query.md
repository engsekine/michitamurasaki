# Contract: タイムライン / 公開ログ一覧クエリ

`features/social/server/queries.ts`。すべて RLS 下で実行（二重防御）。

## `fetchTimeline({ limit = 20, cursor? })`

フォロー中ユーザーの公開ログを新しい順に取得（FR-017〜021）。

| 項目 | 内容 |
|---|---|
| 条件 | `is_public = true` かつ `user_id in (select followee_id from user_follows where follower_id = auth.uid())` |
| ソート | `dive_date desc, id desc`（キーセット） |
| カーソル | `{ diveDate, id }`。`(dive_date, id) < (cursor.diveDate, cursor.id)` で続き取得 |
| 取得列 | `id, user_id, dive_date, location, max_depth_m, bottom_time_min` + owner nickname（`user_details` 結合） |
| 出力 | `{ items: TimelineItem[], nextCursor: Cursor | null }` |
| 空状態 | フォロー 0 件 → `items: []`（UI はフォロー導線）。公開ログ 0 件 → `items: []` |
| 非公開保証 | RLS により `is_public=false` は物理的に取得不可（FR-019 / SC-002） |

## `fetchUserPublicDives(userId, { limit, cursor? })`

特定ユーザーの公開ログ一覧（プロフィール用・FR-015）。

| 項目 | 内容 |
|---|---|
| 条件 | `user_id = :userId` かつ `is_public = true`（本人が見る場合も公開分のみをプロフィール文脈で表示） |
| ソート / カーソル | `fetchTimeline` と同方式 |
| 出力 | `{ items: TimelineItem[], nextCursor }` |

## `fetchFollowState(targetUserId)`

| 出力 | 内容 |
|---|---|
| `isFollowing` | 自分が `targetUserId` をフォロー中か |
| `followerCount` | `targetUserId` のフォロワー数（`count where followee_id = target`） |
| `followingCount` | `targetUserId` のフォロー数（`count where follower_id = target`） |

## パフォーマンス

- タイムライン/公開一覧は `idx_dives_public_user_date (user_id, dive_date desc, id desc) where is_public=true` を利用（SC-004 = 20 件 2 秒以内）
- フォロー集計は PK 前方一致（following）と `idx_user_follows_followee_id`（follower）を利用
