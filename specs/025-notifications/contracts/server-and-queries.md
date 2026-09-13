# Contract: 通知のサーバーアクション / クエリ（service-front）

新規 `service-front/src/features/notifications/server/`。返却型は既存慣習の `ActionResult<T>`（`{ success, ... } | { success: false, error }`）に統一。全アクション / クエリの冒頭で `requireUser`（shared/lib/auth）を通す。ユーザー向けメッセージは日本語。

## queries.ts

### listNotifications

```
listNotifications(params: { cursor?: string }): Promise<{
    items: NotificationItem[];   // 最大 20 件・occurred_at 降順
    nextCursor: string | null;   // 次ページなしは null
}>
```

- keyset ページング（021 タイムラインと同型: `occurred_at < cursor` で次ページ）
- `NotificationItem`: id / type / actorId / actorNickname（`get_user_public_profiles` で解決。退会は null）/ resourceId / occurredAt / readAt
- RLS + `eq('recipient_id', user.id)` の明示条件（二重防御。公開読み取り系ポリシー追加時の退行防止）

### getUnreadNotificationCount

```
getUnreadNotificationCount(): Promise<number>
```

- `read_at is null` の本人行 count（部分インデックス使用）。バッジ表示用。失敗時は 0 を返しページ描画を止めない

### ensureTimedNotifications

```
ensureTimedNotifications(): Promise<void>
```

- リマインド通知の遅延生成 + 90 日清掃（data-model.md D 節の 3 手順）
- 呼び出し箇所: TOP ダッシュボード・通知一覧ページの Server Component（描画前に await）
- 冪等（unique 制約 + on conflict do nothing）。失敗はログのみでページ描画を止めない

## actions.ts（'use server'）

### markNotificationRead

```
markNotificationRead(id: string): Promise<ActionResult>
```

- `update({ read_at: now }) .eq('id', id) .eq('recipient_id', user.id) .is('read_at', null)` + `.select('id')`
- 0 行更新（他人の id・既に既読）は成功扱いでよい（冪等・情報を漏らさない）
- `revalidatePath('/notifications')`

### markAllNotificationsRead

```
markAllNotificationsRead(): Promise<ActionResult>
```

- 本人の未読すべてに `read_at = now()`。`revalidatePath('/notifications')`

### setNotificationPreference

```
setNotificationPreference(type: NotificationType, enabled: boolean): Promise<ActionResult>
```

- `notification_preferences` へ upsert（PK: user_id × type）。`type` はサーバー側でも 4 値 union を検証（不正値は actionFailure）
- OFF → ON に戻しても過去イベントは遡及生成しない（FR-011。何もしなくてよい＝仕様どおり）
- `revalidatePath('/settings/notifications')`

## セキュリティ要件（FR-014 / SC-005）

- 全操作は RLS（本人限定）+ アプリ層の `eq('recipient_id' | 'user_id', user.id)` の二重防御
- `notifications` の UPDATE はガードトリガーにより `read_at` 以外変更不可（直 API での改ざん防止）
- 通知の INSERT 経路: ソーシャル = definer トリガーのみ / リマインド = 本人 INSERT ポリシー。他人宛の通知を API から作ることはできない

## テスト観点（Vitest / モックは既存パターン）

- listNotifications: ページング境界（20 件 / nextCursor）・actor 退会（nickname null）
- getUnreadNotificationCount: 失敗時 0
- ensureTimedNotifications: 当日予定 / 過去日登録予定の除外（FR-009）・OH 期限判定（月末丸めは overhaul.ts のテストが担保）・設定 OFF スキップ・90 日清掃
- markNotificationRead: 既読化・0 行でも成功・他人 id で updates されない
- setNotificationPreference: 不正 type 拒否・upsert
