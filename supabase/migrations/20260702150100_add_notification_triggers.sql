-- ========================================
-- ソーシャル通知の生成トリガー（025 / US1 / FR-001・FR-002）
--
-- Server Action ではなく DB トリガーで生成することで、PostgREST 直叩きを含む
-- すべての経路のイベントを漏れなく通知化する（research.md Decision 1）。
-- security definer: 挿入先 notifications の RLS（本人 INSERT のみ）を越えて
-- 「相手宛」の通知を作るために必要。search_path は '' に固定。
-- 仕様: specs/025-notifications/data-model.md C 節
-- ========================================

-- フォローされたとき、フォローされた側に通知（FR-001）
create or replace function public.notify_on_follow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    -- 防御: 自己フォローは CHECK で禁止済みだが二重防御（FR-007）
    if new.follower_id = new.followee_id then
        return new;
    end if;

    -- 受信者が followed 通知を OFF にしていたら生成しない（FR-011）
    if exists (
        select 1 from public.notification_preferences p
        where p.user_id = new.followee_id
          and p.type = 'followed'
          and p.is_enabled = false
    ) then
        return new;
    end if;

    -- 同一（受信者 × 相手）は 1 行に集約。再発生は occurred_at のみ更新し
    -- read_at は維持する（既読を未読に復活させない / FR-008・Clarification Q3）
    insert into public.notifications (recipient_id, type, actor_id)
    values (new.followee_id, 'followed', new.follower_id)
    on conflict (recipient_id, type, (coalesce(actor_id::text, '')), (coalesce(resource_id::text, '')), dedup_key)
    do update set occurred_at = now();

    return new;
end;
$$;

comment on function public.notify_on_follow() is
    'user_follows の INSERT でフォローされた側に followed 通知を upsert する（設定 OFF は生成しない）';

create trigger user_follows_notify_on_follow
    after insert on public.user_follows
    for each row execute function public.notify_on_follow();

-- 登録ユーザーがバディにタグ付けされたとき、本人に通知（FR-002）
create or replace function public.notify_on_buddy_tag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_dive_owner uuid;
begin
    -- フリーテキストのバディ名では通知しない（FR-002）
    if new.buddy_user_id is null then
        return new;
    end if;

    -- 受信者が buddy_tagged 通知を OFF にしていたら生成しない（FR-011）
    if exists (
        select 1 from public.notification_preferences p
        where p.user_id = new.buddy_user_id
          and p.type = 'buddy_tagged'
          and p.is_enabled = false
    ) then
        return new;
    end if;

    select d.user_id into v_dive_owner from public.dives d where d.id = new.dive_id;

    -- 防御: 自己タグは prevent_self_buddy で禁止済みだが二重防御（FR-007）
    if v_dive_owner is null or v_dive_owner = new.buddy_user_id then
        return new;
    end if;

    -- 同一（受信者 × ログ）は 1 行に集約（外して付け直しても増えない）
    insert into public.notifications (recipient_id, type, actor_id, resource_id)
    values (new.buddy_user_id, 'buddy_tagged', v_dive_owner, new.dive_id)
    on conflict (recipient_id, type, (coalesce(actor_id::text, '')), (coalesce(resource_id::text, '')), dedup_key)
    do update set occurred_at = now();

    return new;
end;
$$;

comment on function public.notify_on_buddy_tag() is
    'dive_log_buddies の INSERT でタグ付けされた本人に buddy_tagged 通知を upsert する（フリーテキスト・設定 OFF は生成しない）';

create trigger dive_log_buddies_notify_on_buddy_tag
    after insert on public.dive_log_buddies
    for each row execute function public.notify_on_buddy_tag();
