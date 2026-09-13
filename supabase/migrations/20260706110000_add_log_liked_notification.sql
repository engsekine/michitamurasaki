-- ========================================
-- log_liked 通知の追加（027 / US3）
--
-- dive_likes の INSERT でログ作成者に「いいねされた」通知を upsert する。
-- 025 の notify_on_follow / notify_on_buddy_tag と同一パターン:
--   security definer + 通知設定参照 + 集約 upsert（read_at 維持）。
-- 仕様: specs/027-log-likes/data-model.md §2
-- ========================================

-- 1. type CHECK 制約の拡張（既存行に影響なし）
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
    check (type in ('followed', 'buddy_tagged', 'plan_reminder', 'overhaul_reminder', 'log_liked'));

alter table public.notification_preferences drop constraint notification_preferences_type_check;
alter table public.notification_preferences add constraint notification_preferences_type_check
    check (type in ('followed', 'buddy_tagged', 'plan_reminder', 'overhaul_reminder', 'log_liked'));

-- 2. 生成トリガー
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

    -- 同一（いいねした人 × ログ）は 1 行に集約（FR-011）。
    -- 再いいねは occurred_at のみ更新し read_at を維持する（既読は未読に戻らない）
    insert into public.notifications (recipient_id, type, actor_id, resource_id)
    values (v_dive_owner, 'log_liked', new.user_id, new.dive_id)
    on conflict (recipient_id, type, (coalesce(actor_id::text, '')), (coalesce(resource_id::text, '')), dedup_key)
    do update set occurred_at = now();

    return new;
end;
$$;

comment on function public.notify_on_like() is
    'dive_likes の INSERT でログ作成者に log_liked 通知を upsert する（自己いいね・設定 OFF は生成しない。取り消しでは削除しない）';

create trigger dive_likes_notify_on_like
    after insert on public.dive_likes
    for each row execute function public.notify_on_like();
