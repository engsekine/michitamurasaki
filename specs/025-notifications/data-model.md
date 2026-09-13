# Phase 1 Data Model: 通知機能（アプリ内通知）

`public` スキーマに新規テーブル 2 つと生成トリガー 2 本を追加する。マイグレーションは 2 本（テーブル群 / 生成トリガー）。sql.md 準拠（snake_case・timestamptz・CHECK・RLS・`(select auth.uid())`・`set search_path = ''`）。

## A. notifications（新規）

ユーザーが受け取るアプリ内通知。受信者本人のみ参照・既読化できる。

| カラム | 型 | 制約 | 意味 |
|--------|----|------|------|
| id | uuid | PK, default gen_random_uuid() | |
| recipient_id | uuid | not null, references public.users(id) on delete cascade | 受信者 |
| type | text | not null, check in ('followed','buddy_tagged','plan_reminder','overhaul_reminder') | 通知種別 |
| actor_id | uuid | references public.users(id) on delete set null | 発生元ユーザー（ソーシャル通知のみ。退会で null） |
| resource_id | uuid | nullable（FK なし） | 対象リソース（buddy_tagged=dive / plan_reminder=plan / overhaul_reminder=regulator）。複数テーブルを指すポリモーフィック参照のため FK は張れない。消滅時の挙動は FR-012 で吸収 |
| dedup_key | text | not null, default '' | リマインドの重複防止キー（期限日 YYYY-MM-DD）。ソーシャル通知は '' |
| occurred_at | timestamptz | not null, default now() | 発生日時（集約時はここだけ更新） |
| read_at | timestamptz | nullable | 既読日時。null = 未読 |
| created_at | timestamptz | not null, default now() | |

### 種別ごとのカラム使用

| type | actor_id | resource_id | dedup_key |
|------|----------|-------------|-----------|
| followed | フォローした人 | null | '' |
| buddy_tagged | ログ所有者 | dive_id | '' |
| plan_reminder | null | plan_id | 予定日（YYYY-MM-DD） |
| overhaul_reminder | null | regulator_id | OH 期限日（YYYY-MM-DD） |

### インデックス

```sql
-- 集約の同一性（FR-008）。nullable 列は coalesce で正規化した式 unique
create unique index notifications_dedup_key
    on public.notifications (recipient_id, type, coalesce(actor_id::text, ''), coalesce(resource_id::text, ''), dedup_key);

-- 一覧（新しい順 keyset ページング）
create index idx_notifications_recipient_occurred
    on public.notifications (recipient_id, occurred_at desc);

-- 未読バッジ count（全認証ページで実行されるため部分インデックス必須）
create index idx_notifications_unread
    on public.notifications (recipient_id) where read_at is null;
```

### RLS

```sql
alter table public.notifications enable row level security;

-- 本人のみ参照
create policy "users can read own notifications"
    on public.notifications for select
    using ((select auth.uid()) = recipient_id);

-- 本人のみ作成可（リマインドの遅延生成用。ソーシャル通知は definer トリガーが挿入するためポリシー不要）
create policy "users can insert own notifications"
    on public.notifications for insert
    with check ((select auth.uid()) = recipient_id);

-- 本人のみ更新可（変更可能なカラムは下のガードトリガーで read_at に限定）
create policy "users can update own notifications"
    on public.notifications for update
    using ((select auth.uid()) = recipient_id)
    with check ((select auth.uid()) = recipient_id);

-- 本人のみ削除可（90 日清掃の遅延削除用）
create policy "users can delete own notifications"
    on public.notifications for delete
    using ((select auth.uid()) = recipient_id);
```

### ガードトリガー（UPDATE は read_at のみ）

021 の `enforce_buddy_optout_only_update` と同型。`recipient_id / type / actor_id / resource_id / dedup_key / occurred_at / created_at` の変更を拒否し、既読化（read_at の変更）だけを許可する。

## B. notification_preferences（新規）

通知種別ごとの受け取り設定。**行が存在しない = ON（既定）**。OFF にしたときだけ行を upsert する（research.md Decision 6）。

| カラム | 型 | 制約 | 意味 |
|--------|----|------|------|
| user_id | uuid | not null, references public.users(id) on delete cascade | |
| type | text | not null, check（notifications.type と同一の 4 値） | |
| is_enabled | boolean | not null | false = 受け取らない |
| updated_at | timestamptz | not null, default now() | handle_updated_at トリガーで自動更新 |

- 主キー: `(user_id, type)`
- RLS: select / insert / update / delete すべて `(select auth.uid()) = user_id` の本人限定

## C. 生成トリガー（ソーシャル通知）

2 本とも `security definer` + `set search_path = ''`。参照はすべてスキーマ修飾。

### notify_on_follow — after insert on public.user_follows

```text
1. notification_preferences に (followee_id, 'followed', is_enabled=false) があれば何もしない（FR-011）
2. 防御: new.follower_id = new.followee_id なら何もしない（自己フォローは CHECK 済みだが二重防御 / FR-007）
3. notifications へ upsert:
   (recipient_id=new.followee_id, type='followed', actor_id=new.follower_id)
   on conflict → occurred_at = now() のみ更新（read_at 維持 / FR-008・Q3）
```

### notify_on_buddy_tag — after insert on public.dive_log_buddies

```text
1. new.buddy_user_id is null（フリーテキスト）なら何もしない（FR-002）
2. notification_preferences に (buddy_user_id, 'buddy_tagged', false) があれば何もしない
3. dive の所有者を actor として upsert:
   (recipient_id=new.buddy_user_id, type='buddy_tagged', actor_id=dive.user_id, resource_id=new.dive_id)
   on conflict → occurred_at のみ更新
※ 自己タグは既存 prevent_self_buddy が禁止済み。オプトアウト後の再タグは既存の部分 unique が
   INSERT 自体をブロックするため、本トリガーに再通知の考慮は不要（spec Edge Case）
```

## D. リマインド生成・清掃（app 層 / DDL なし）

`ensureTimedNotifications()`（features/notifications/server/queries.ts）が TOP・通知一覧の表示時に本人分のみ実行:

1. `dive_plans` から `planned_on = JST 今日` かつ `created_at::date <= planned_on` の予定を取得し、`(recipient, 'plan_reminder', resource_id=plan.id, dedup_key=planned_on)` を upsert（on conflict do nothing。リマインドは日時更新も不要）
2. `regulators` から OH 期限（`overhaul.ts` の計算で期限日 <= JST 今日）の機材を取得し、`(recipient, 'overhaul_reminder', resource_id=regulator.id, dedup_key=期限日)` を upsert（同上）
3. `occurred_at < now() - interval '90 days'` の本人通知を削除（FR-013）

- 通知設定 OFF の種別はスキップ（FR-011）
- 「過去日で登録された予定は対象外」（FR-009）は条件 1 の `created_at::date <= planned_on` で表現

## E. 新規マイグレーションの要否

- `<ts>_create_notifications.sql`: notifications / notification_preferences + RLS + インデックス + ガードトリガー + `handle_updated_at` トリガー
- `<ts>_add_notification_triggers.sql`: notify_on_follow / notify_on_buddy_tag
- 既存テーブルへの変更・バックフィルはなし
