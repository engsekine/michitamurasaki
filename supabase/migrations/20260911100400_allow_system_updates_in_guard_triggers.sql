-- ========================================
-- カラム制限ガードトリガが FK アクション・退会処理を阻害する問題の修正（セキュリティ監査対応 2026-09）
--
-- 問題:
--   enforce_buddy_optout_only_update（20260702110300）と enforce_notification_read_only_update
--   （20260702150000）は「利用者が変更できる列」を制限する BEFORE UPDATE トリガだが、
--   参照整合性アクション（notifications.actor_id の on delete set null）や
--   退会フォールバック（handle_buddy_user_deleted の buddy_user_id NULL 化）による
--   システム由来の UPDATE も同じトリガを通り例外になる。結果、誰かにバディとしてタグ付けされた／
--   フォロー・いいねをしたことのあるユーザーの行を public.users から削除できず、
--   他人を自分のログにタグ付けするだけで相手のアカウントを削除不能にできた。
--
-- 対応:
--   - 他トリガ（FK アクション・退会処理）の内側で発火した UPDATE は pg_trigger_depth() > 1 になるため通す。
--     利用者は PostgREST からトリガを定義・起動できないので、直接の UPDATE（depth = 1）は従来どおり制限される
--   - handle_buddy_user_deleted は security definer にし、管理者が RLS 経由で users を削除する経路でも
--     dive_log_buddies の UPDATE が RLS で 0 行にならないようにする
--
-- 仕様: specs/021-buddy-follow-timeline/data-model.md / specs/025-notifications/data-model.md
-- ========================================

create or replace function public.enforce_buddy_optout_only_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    -- FK アクション・退会フォールバックなど、他トリガから発火した UPDATE は通す
    if pg_trigger_depth() > 1 then
        return new;
    end if;

    if new.id is distinct from old.id
       or new.dive_id is distinct from old.dive_id
       or new.buddy_user_id is distinct from old.buddy_user_id
       or new.buddy_name is distinct from old.buddy_name
       or new.created_at is distinct from old.created_at then
        raise exception 'only removed_by_buddy can be updated on dive_log_buddies';
    end if;
    return new;
end;
$$;

comment on function public.enforce_buddy_optout_only_update() is
    'dive_log_buddies の UPDATE を removed_by_buddy の変更のみに制限する（タグの付け替え・改名を防ぐ）。FK アクション・退会処理由来の UPDATE は対象外';

create or replace function public.enforce_notification_read_only_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    -- FK アクション（actor_id の on delete set null）など、他トリガから発火した UPDATE は通す
    if pg_trigger_depth() > 1 then
        return new;
    end if;

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
    'notifications の UPDATE を read_at / occurred_at の変更のみに制限する（内容の改ざんを防ぐ。occurred_at は集約 upsert 用）。FK アクション由来の UPDATE は対象外';

create or replace function public.handle_buddy_user_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    update public.dive_log_buddies b
    set buddy_name = coalesce(
            (select ud.nickname from public.user_details ud where ud.user_id = old.id),
            '退会したユーザー'),
        buddy_user_id = null
    where b.buddy_user_id = old.id;
    return old;
end;
$$;

comment on function public.handle_buddy_user_deleted() is
    'users 削除時に、当該ユーザーを参照する dive_log_buddies の buddy_user_id を NULL 化し nickname を buddy_name へ退避する（security definer: 削除者の RLS に依存しない）';
