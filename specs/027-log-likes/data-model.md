# Data Model: ログのいいね機能

**Date**: 2026-07-04 | **Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

マイグレーションは 2 ファイル（1 マイグレーション 1 目的 / sql.md）:

1. `<ts>_create_dive_likes.sql` — いいねテーブル + RLS + インデックス
2. `<ts>_add_log_liked_notification.sql` — 通知種別 `log_liked` の追加 + 生成トリガー

## 1. `dive_likes`（新規テーブル）

「どの利用者が・どのログに・いつ」いいねしたか。利用者 × ログの組で一意（FR-003）。取り消しは物理削除（履歴を持たない / spec Assumption）。

| カラム | 型 | 制約 | 説明 |
|--------|----|------|------|
| `user_id` | `uuid` | not null / FK → `public.users(id)` on delete cascade | いいねした利用者。退会で連動削除（件数から除外 = spec Edge Case） |
| `dive_id` | `uuid` | not null / FK → `public.dives(id)` on delete cascade | 対象ログ。ログ削除で連動削除 |
| `created_at` | `timestamptz` | not null / default `now()` | いいねした日時。一覧の並び順（FR-007） |

- **主キー**: `(user_id, dive_id)` 複合 PK — 同一利用者 × 同一ログ 1 件まで（FR-003）
- 更新は発生しない（付ける = INSERT / 取り消す = DELETE）ため `updated_at` は持たない

### インデックス

| 名前 | 定義 | 用途 |
|------|------|------|
| `idx_dive_likes_dive_id` | `(dive_id)` | FK インデックス（必須）+ 件数集計（FR-004） |
| `idx_dive_likes_user_id_created_at` | `(user_id, created_at desc, dive_id desc)` | いいね一覧の keyset ページング（FR-007 / SC-005）。PK の user_id 前方一致では並び順を賄えないため別途作成 |

### RLS ポリシー（三重防御の DB 層 / FR-006・FR-014）

```sql
alter table public.dive_likes enable row level security;

-- 読み取り: 自分のいいね全件 + 閲覧可能なログ（公開中 or 本人所有）のいいね（件数集計用）
create policy "users can read likes of viewable dives"
    on public.dive_likes for select
    to authenticated
    using (
        user_id = (select auth.uid())
        or exists (
            select 1 from public.dives d
            where d.id = dive_id
              and (d.user_id = (select auth.uid()) or (d.is_public and d.deleted_at is null))
        )
    );

-- 作成: 本人の行 × 公開中の他人のログのみ（自己いいね・非公開ログ・削除済みログを DB 層で拒否）
create policy "users can like public dives of others"
    on public.dive_likes for insert
    to authenticated
    with check (
        user_id = (select auth.uid())
        and exists (
            select 1 from public.dives d
            where d.id = dive_id
              and d.is_public
              and d.deleted_at is null
              and d.user_id <> (select auth.uid())
        )
    );

-- 削除（取り消し）: 本人のいいねのみ（FR-002）
create policy "users can delete own likes"
    on public.dive_likes for delete
    to authenticated
    using (user_id = (select auth.uid()));
```

- UPDATE ポリシーは定義しない（更新操作が存在しない = デフォルト deny のまま）
- `auth.uid()` はすべて `(select ...)` で包む（`auth_rls_initplan` 対策 / sql.md）

### `comment on`

```sql
comment on table public.dive_likes is '公開ダイブログへのいいね。利用者×ログで一意、取り消しは物理削除（履歴なし）';
comment on column public.dive_likes.created_at is 'いいねした日時。いいね一覧はこの降順で表示する';
```

## 2. 通知種別 `log_liked` の追加（既存テーブルの変更）

### 2-1. CHECK 制約の拡張（2 テーブル）

`type` はどちらも inline CHECK（自動命名 `notifications_type_check` / `notification_preferences_type_check`）のため、drop → 再作成で `'log_liked'` を追加する。既存行には影響しない（R4）。

```sql
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
    check (type in ('followed', 'buddy_tagged', 'plan_reminder', 'overhaul_reminder', 'log_liked'));

alter table public.notification_preferences drop constraint notification_preferences_type_check;
alter table public.notification_preferences add constraint notification_preferences_type_check
    check (type in ('followed', 'buddy_tagged', 'plan_reminder', 'overhaul_reminder', 'log_liked'));
```

### 2-2. `log_liked` 通知のフィールド割り当て

| notifications カラム | 値 |
|---------------------|----|
| `recipient_id` | いいねされたログの作成者（`dives.user_id`） |
| `type` | `'log_liked'` |
| `actor_id` | いいねした利用者 |
| `resource_id` | 対象ログ（`dive_id`）。遷移先 `/dives/[id]` の解決に使用 |
| `dedup_key` | `''`（ソーシャル通知の既存規約どおり） |

集約の同一性は既存の `notifications_dedup_key` unique index（受信者・種別・相手・対象）がそのまま機能する: 同一の「いいねした人 × ログ」は 1 行に集約され（FR-011）、異なる利用者のいいねは別通知になる（US3-AC5）。

### 2-3. 生成トリガー `notify_on_like()`

`notify_on_follow` / `notify_on_buddy_tag`（20260702150100）と同型。

```sql
create or replace function public.notify_on_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_dive_owner uuid;
begin
    select d.user_id into v_dive_owner
    from public.dives d
    where d.id = new.dive_id;

    -- 防御: 自己いいねは RLS で禁止済みだが二重防御（FR-006）
    if v_dive_owner is null or v_dive_owner = new.user_id then
        return new;
    end if;

    -- 通知設定 OFF なら生成しない（FR-012。いいね自体は成立している）
    if exists (
        select 1 from public.notification_preferences p
        where p.user_id = v_dive_owner
          and p.type = 'log_liked'
          and p.is_enabled = false
    ) then
        return new;
    end if;

    -- 同一（いいねした人 × ログ）は 1 行に集約。再いいねは occurred_at のみ更新し read_at を維持（FR-011）
    insert into public.notifications (recipient_id, type, actor_id, resource_id)
    values (v_dive_owner, 'log_liked', new.user_id, new.dive_id)
    on conflict (recipient_id, type, (coalesce(actor_id::text, '')), (coalesce(resource_id::text, '')), dedup_key)
    do update set occurred_at = now();

    return new;
end;
$$;

create trigger dive_likes_notify_on_like
    after insert on public.dive_likes
    for each row execute function public.notify_on_like();
```

- `security definer` + `set search_path = ''`（他人宛の INSERT は RLS を越える必要があるため。sql.md 準拠）
- 取り消し（DELETE）時に通知は削除しない（R3。025 のフォロー解除と同方針）
- 既存の `enforce_notification_read_only_update` ガードは `occurred_at` の更新を許可済みのため、集約 upsert はそのまま通る

## 3. 変更しないもの

- `dives` テーブル: カラム追加なし（件数は都度集計 / R1）
- `notifications` / `notification_preferences` の構造・RLS・インデックス: 変更なし（CHECK 制約のみ拡張）
- admin-front から参照するテーブル: 影響なし

## 4. ライフサイクル

| イベント | dive_likes | notifications |
|----------|-----------|---------------|
| いいねする | INSERT（重複時は一意制約違反 → Server Action で冪等成功に変換） | トリガーが upsert（設定 OFF ならスキップ） |
| いいねを取り消す | DELETE | 変化なし（通知は残る） |
| 再いいね | INSERT | 既存通知の `occurred_at` のみ更新（`read_at` 維持 = 未読に戻らない） |
| ログを削除 | cascade で削除 | 残る。遷移時は表示側フォールバック（025 FR-012 の既存挙動） |
| ログを非公開化 | 行は残る（既閲覧不可）。一覧・件数からは RLS で自動除外 | 残る |
| いいねした利用者が退会 | cascade で削除（件数から除外） | `actor_id` が set null（表示側で「退会したユーザー」扱い / 025 既存挙動） |
