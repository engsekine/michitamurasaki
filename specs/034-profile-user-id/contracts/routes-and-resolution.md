# Contract: ルーティング・解決・リンク生成（034 Rev.2）

## ルート（`/users/[slug]`。Rev.1 と同構造）

| slug | 挙動 |
|---|---|
| uuid 形式 | handle を解決し `/users/<handle>` へ転送（followers/following は下層パス維持）。不在は notFound |
| それ以外 | `lower(trim())` 正規化して `get_user_id_by_handle` で解決 → 表示。不在は notFound（FR-007） |
| `/users/search` | 変更なし（静的ルート優先） |

- 3 ページ共通処理は `requireProfileBySlug(slug, subPath)`（React cache）に集約（Rev.1 踏襲）
- canonical は handle URL（`/users/<handle>`）
- 表示内容・アクセス制御は現行と同一（FR-009）

## profilePath ヘルパー（`shared/lib/profile-path/`・Rev.2）

```ts
profilePath({ userId, handle }: { userId: string; handle?: string | null }): string
// handle があれば `/users/${handle}`（handle は保存時に小文字英数字が保証されておりエンコード不要）
// 無ければ `/users/${userId}`（metadata 未同期時などの安全網。ページ側の転送で正規化される）

isValidHandle(value: string): boolean   // HANDLE_PATTERN + 予約語でない
normalizeHandle(value: string): string  // lower(trim())
isUuid(value: string): boolean          // Rev.1 と同じ
```

- Rev.1 の `isUrlSafeNickname` / `NICKNAME_FORBIDDEN_PATTERN` は削除

## リンク生成（FR-004。表示は nickname のまま・リンクのみ handle）

| 箇所 | データ源 |
|---|---|
| AuthNav（マイプロフィール） | `user_metadata.handle`（サインアップ / 補完 / 変更時に同期） |
| Timeline / LikedDivesList | `ownerHandle`（`resolveProfiles` で nickname と同時取得） |
| FollowList / ユーザー検索結果 | `FollowUser.handle` |
| FollowCounts / Breadcrumbs | プロフィール（`PublicProfile.handle`）から |
| DiveDetail（バディ） | `DiveBuddy.handle`（登録ユーザーのみ。プロフィール解決で取得） |
| notificationTarget（followed） | `actorHandle`（通知一覧の解決で取得） |
| revalidatePath（social actions） | `revalidatePath('/users/[slug]', 'page')`（Rev.1 のまま） |

## フォーム（FR-002/003/006）

共有 schema `userProfileFields.handle`:

| 検証 | エラーメッセージ（案） |
|---|---|
| 必須 | ユーザー ID を入力してください |
| 形式（transform で小文字化 → HANDLE_PATTERN） | ユーザー ID は半角英小文字・数字・ - _ の 3〜30 文字（先頭は英字）で入力してください |
| 予約語 | このユーザー ID は使用できません |
| 重複（server: is_handle_taken + 一意制約フォールバック） | このユーザー ID は既に使われています |

- 対象フォーム: サインアップ（001）/ Google 補完（016）/ 会員情報（account）。3 つとも共有 schema 経由
- Server Actions: `signUp`（meta に handle）/ `completeProfile`（INSERT + metadata 同期）/ `updateProfile`（UPDATE + metadata 同期。Rev.1 の nickname 同期は handle 同期に置換）
