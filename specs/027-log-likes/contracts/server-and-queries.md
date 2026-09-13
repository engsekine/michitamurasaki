# Contracts: Server Actions / クエリ

**Feature**: 027-log-likes | **Plan**: [../plan.md](../plan.md)

すべて `features/social/server/` に追加する。戻り値は既存共通型 `ActionResult<T>`（`@/shared/types/action-result`）。

## Server Actions（`features/social/server/actions.ts` に追加）

### `likeDive(diveId: string): Promise<ActionResult<{ isLiked: true }>>`

- 認証ガード: `requireUser`（未ログインは失敗）
- `dive_likes` へ INSERT（`user_id` はセッションユーザー。クライアント入力を信用しない）
- 一意制約違反（23505 = 既にいいね済み）は **冪等成功** に変換する（`followUser` と同型。連打対策 / FR-003）
- RLS 違反（42501 = 非公開・削除済み・自分のログ）は「このログにはいいねできません」の失敗を返す（US1-AC5 / Edge Case）
- 成功時 `revalidatePath('/dives/[id]', 'page')` 相当 + `/likes` + `/`（タイムライン）を revalidate
- 通知は DB トリガーが生成する（Action 側では何もしない）

### `unlikeDive(diveId: string): Promise<ActionResult<{ isLiked: false }>>`

- 認証ガード: `requireUser`
- 本人の `dive_likes` 行を DELETE（RLS で本人行のみ / FR-002）
- 対象行が既に無い場合も **冪等成功**（連打・多端末競合対策）
- 成功時の revalidate は `likeDive` と同じ

## クエリ（`features/social/server/queries.ts`）

### `fetchLikedDives(options?: { limit?; cursor?: LikedDivesCursor | null }): Promise<LikedDivesPage>`（新規）

- 本人の `dive_likes` を起点に `dives` を inner join（PostgREST embed）し、`(created_at desc, dive_id desc)` の keyset ページング（20 件/頁）で取得
- JOIN 先が RLS で見えない行（非公開化・削除済み）は自動的に除外される（FR-009）
- 各項目は既存 `TimelineItem` 互換に変換し、`likeCount` / `likedByMe`（このページでは常に true）を付加
- 戻り値: `{ items: TimelineItem[]; nextCursor: LikedDivesCursor | null }`

### `loadMoreLikedDives(cursor: LikedDivesCursor): Promise<LikedDivesPage>`（新規 Server Action）

- いいね一覧の「さらに読み込む」から呼ばれる `fetchLikedDives` の薄いラッパー（025 `loadMoreNotifications` と同型）

### `fetchTimeline(...)`（変更）

- 既存のタイムライン取得に、表示対象の dive ID 群に対する **バッチ 1 クエリ** を追加（R7 / N+1 禁止）:
  - `dive_likes` を `dive_id in (...)` で `(dive_id, user_id)` 行として取得し、lib/likes（`buildLikeInfo`）で件数と `likedByMe` を同時に集計する（PostgREST の集約機能に依存しない）
- `TimelineItem` に `likeCount: number` / `likedByMe: boolean` を追加

### ログ詳細向け（`app/(authenticated)/dives/[id]/page.tsx` から利用）

- `fetchDiveLikeState(diveId: string): Promise<{ likeCount: number; likedByMe: boolean }>`（新規・social 所管）
- 自分のログ（canManage=true）でも件数表示のため呼び出す（US1-AC5「件数の確認はできる」）

## 型（`features/social/types.ts` に追加・変更）

```ts
// TimelineItem（変更）: いいね表示情報を追加
interface TimelineItem {
    // ...既存フィールド
    likeCount: number;
    likedByMe: boolean;
}

// いいね一覧のカーソル（新規。並びが「いいねした日時」のため TimelineCursor とは別型）
interface LikedDivesCursor {
    likedAt: string; // dive_likes.created_at（ISO 8601）
    diveId: string;
}

// いいね一覧ページ（新規）
interface LikedDivesPage {
    items: TimelineItem[];
    nextCursor: LikedDivesCursor | null;
}
```

## 通知側の変更（`features/notifications/`）

| 対象 | 変更 |
|------|------|
| `constants.ts` — `NotificationType` | `'log_liked'` を追加 |
| `constants.ts` — `NOTIFICATION_TYPE_LABELS` | `log_liked: 'ログにいいねされたとき'`（設定画面は既存の種別列挙 UI がそのまま拾う） |
| `constants.ts` — `NOTIFICATION_MESSAGES` | `log_liked: '{nickname} さんがあなたのログにいいねしました'`（actor 退会時の表示は既存挙動に従う） |
| `lib/notificationTarget/` | `log_liked` → `/dives/{resource_id}`。ログ消滅時のフォールバックは既存の buddy_tagged と同じ規則 |

## テスト契約（Vitest 先行）

- `likeDive`: 成功 / 23505 冪等成功 / 42501 失敗文言 / 未ログイン失敗
- `unlikeDive`: 成功 / 行なし冪等成功 / 未ログイン失敗
- `fetchLikedDives`: 並び順（created_at 降順）/ ページング（nextCursor）/ 空
- `fetchTimeline` 拡張: likeCount / likedByMe のバッチ結合が正しい
- `notificationTarget`: `log_liked` の遷移先解決 / 消滅時フォールバック
