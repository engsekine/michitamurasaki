-- ========================================
-- notifications / notification_preferences テーブル（025 / US1-US3）
--
-- アプリ内通知。受信者本人のみ参照・既読化・削除できる（FR-014）。
-- ソーシャル通知は後続マイグレーションの definer トリガーが、
-- リマインド通知は本人の遅延生成（INSERT ポリシー）が挿入する。
-- 仕様: specs/025-notifications/data-model.md
-- ========================================

create table public.notifications (
    id uuid primary key default gen_random_uuid(),
    recipient_id uuid not null references public.users(id) on delete cascade,
    type text not null check (type in ('followed', 'buddy_tagged', 'plan_reminder', 'overhaul_reminder')),
    actor_id uuid references public.users(id) on delete set null,
    -- 対象リソース（buddy_tagged=dive / plan_reminder=plan / overhaul_reminder=regulator）。
    -- 複数テーブルを指すポリモーフィック参照のため FK は張れない。消滅時の挙動は表示側で吸収（FR-012）
    resource_id uuid,
    -- リマインドの重複防止キー（期限日 YYYY-MM-DD）。ソーシャル通知は ''
    dedup_key text not null default '',
    occurred_at timestamptz not null default now(),
    read_at timestamptz,
    created_at timestamptz not null default now()
);

comment on table public.notifications is 'ユーザーが受け取るアプリ内通知。受信者本人のみ参照・既読化できる';
comment on column public.notifications.resource_id is '種別ごとの対象（dive/plan/regulator）。複数テーブル参照のため FK なし';
comment on column public.notifications.dedup_key is 'リマインドの「1 回だけ」を保証する期限日キー。ソーシャル通知は空文字';
comment on column public.notifications.read_at is '既読日時。null = 未読';

-- 集約の同一性（FR-008）。nullable 列は coalesce で正規化した式 unique。
-- 同一（受信者・種別・相手・対象・期限日）の通知は 1 行に集約される
create unique index notifications_dedup_key
    on public.notifications (recipient_id, type, coalesce(actor_id::text, ''), coalesce(resource_id::text, ''), dedup_key);

-- 一覧（新しい順 keyset ページング）
create index idx_notifications_recipient_occurred
    on public.notifications (recipient_id, occurred_at desc, id desc);

-- 未読バッジ count（全認証ページで実行されるため部分インデックス）
create index idx_notifications_unread
    on public.notifications (recipient_id) where read_at is null;

alter table public.notifications enable row level security;

create policy "users can read own notifications"
    on public.notifications for select
    using ((select auth.uid()) = recipient_id);

-- 本人のみ作成可（リマインドの遅延生成用）。他人宛の通知は API から作れない
create policy "users can insert own notifications"
    on public.notifications for insert
    with check ((select auth.uid()) = recipient_id);

-- 本人のみ更新可。変更可能なカラムは下のガードトリガーで read_at に限定する
create policy "users can update own notifications"
    on public.notifications for update
    using ((select auth.uid()) = recipient_id)
    with check ((select auth.uid()) = recipient_id);

-- 本人のみ削除可（90 日清掃の遅延削除用 / FR-013）
create policy "users can delete own notifications"
    on public.notifications for delete
    using ((select auth.uid()) = recipient_id);

-- ========================================
-- UPDATE ガード: read_at / occurred_at 以外の変更を拒否する（改ざん防止）。
-- 021 の enforce_buddy_optout_only_update と同型。
-- occurred_at を許可するのは、生成トリガーの集約 upsert（on conflict do update set
-- occurred_at = now()）もこの BEFORE UPDATE トリガーを通過するため。
-- 通知の内容（種別・宛先・発生元・対象）は引き続き変更不可
-- ========================================
create or replace function public.enforce_notification_read_only_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.id is distinct from old.id
       or new.recipient_id is distinct from old.recipient_id
       or new.type is distinct from old.type
       or new.actor_id is distinct from old.actor_id
       or new.resource_id is distinct from old.resource_id
       or new.dedup_key is distinct from old.dedup_key
       or new.created_at is distinct from old.created_at then
        raise exception 'only read_at and occurred_at can be updated on notifications';
    end if;
    return new;
end;
$$;

comment on function public.enforce_notification_read_only_update() is
    'notifications の UPDATE を read_at / occurred_at の変更のみに制限する（内容の改ざんを防ぐ。occurred_at は集約 upsert 用）';

create trigger notifications_enforce_read_only_update
    before update on public.notifications
    for each row execute function public.enforce_notification_read_only_update();

-- ========================================
-- notification_preferences: 種別ごとの受け取り設定。
-- 行が存在しない = ON（既定）。OFF にしたときだけ行を upsert する
-- ========================================
create table public.notification_preferences (
    user_id uuid not null references public.users(id) on delete cascade,
    type text not null check (type in ('followed', 'buddy_tagged', 'plan_reminder', 'overhaul_reminder')),
    is_enabled boolean not null,
    updated_at timestamptz not null default now(),

    primary key (user_id, type)
);

comment on table public.notification_preferences is
    '通知種別ごとの受け取り設定。行なし = 受け取る（既定）。OFF 時のみ行を作る';

create trigger notification_preferences_handle_updated_at
    before update on public.notification_preferences
    for each row
    execute function public.handle_updated_at();

alter table public.notification_preferences enable row level security;

create policy "users can read own notification preferences"
    on public.notification_preferences for select
    using ((select auth.uid()) = user_id);

create policy "users can insert own notification preferences"
    on public.notification_preferences for insert
    with check ((select auth.uid()) = user_id);

create policy "users can update own notification preferences"
    on public.notification_preferences for update
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

create policy "users can delete own notification preferences"
    on public.notification_preferences for delete
    using ((select auth.uid()) = user_id);
