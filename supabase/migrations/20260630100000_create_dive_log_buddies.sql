-- ========================================
-- dive_log_buddies テーブル
-- ダイブログの同行バディ。登録ユーザー参照（buddy_user_id）または
-- フリーテキスト名（buddy_name）のいずれか一方を保持する中間テーブル。
-- dives × users / フリーテキストの多対多を 1NF で正規化（spec 021）。
-- ========================================
create table public.dive_log_buddies (
    id uuid primary key default gen_random_uuid(),
    dive_id uuid not null references public.dives(id) on delete cascade,
    buddy_user_id uuid references public.users(id) on delete set null,
    buddy_name text,
    removed_by_buddy boolean not null default false,
    created_at timestamptz not null default now(),

    -- 登録ユーザー or フリーテキストのいずれか一方のみ
    constraint dive_log_buddies_target_check check (
        (buddy_user_id is not null and buddy_name is null)
        or (buddy_user_id is null and buddy_name is not null)
    ),
    -- フリーテキスト名は trim 後 1〜100 文字
    constraint dive_log_buddies_name_len_check check (
        buddy_name is null or (length(trim(buddy_name)) between 1 and 100)
    )
);

-- 同一ログに同一登録ユーザーを重複タグ不可（本人除去済み行も残るため再タグ付けブロックになる）
create unique index dive_log_buddies_dive_user_key
    on public.dive_log_buddies (dive_id, buddy_user_id)
    where buddy_user_id is not null;

create index idx_dive_log_buddies_dive_id on public.dive_log_buddies (dive_id);
create index idx_dive_log_buddies_buddy_user_id on public.dive_log_buddies (buddy_user_id);

comment on table public.dive_log_buddies is 'ダイブログの同行バディ。登録ユーザー参照またはフリーテキスト名のいずれか一方を保持';
comment on column public.dive_log_buddies.buddy_user_id is '登録ユーザーのバディ。退会時は handle_buddy_user_deleted トリガで nickname を buddy_name へ退避し NULL 化';
comment on column public.dive_log_buddies.buddy_name is 'フリーテキスト名（未登録者 or 退会フォールバック）。1〜100 文字';
comment on column public.dive_log_buddies.removed_by_buddy is 'タグ付けされた本人が自分のタグを除去したか。true は非表示かつ所有者も削除不可（再タグ付けブロック）';

-- ========================================
-- 自己バディ防止トリガ
-- buddy_user_id がそのログの所有者と一致する登録を禁止（CHECK は他テーブル参照不可のためトリガ）
-- ========================================
create or replace function public.prevent_self_buddy()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.buddy_user_id is not null
       and new.buddy_user_id = (select d.user_id from public.dives d where d.id = new.dive_id) then
        raise exception 'cannot tag the dive owner as a buddy';
    end if;
    return new;
end;
$$;

create trigger dive_log_buddies_prevent_self_buddy
    before insert or update on public.dive_log_buddies
    for each row execute function public.prevent_self_buddy();

-- ========================================
-- 退会フォールバックトリガ（T006）
-- users 削除前に、その人を指すバディ行の buddy_user_id を NULL 化し、
-- 当時の nickname を buddy_name へ退避して target_check 整合とリンク切れ回避を両立する。
-- ※ BEFORE DELETE on users。FK の set null / user_details の cascade より前に走る。
-- ========================================
create or replace function public.handle_buddy_user_deleted()
returns trigger
language plpgsql
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

create trigger users_handle_buddy_on_delete
    before delete on public.users
    for each row execute function public.handle_buddy_user_deleted();

-- ========================================
-- RLS
-- ========================================
alter table public.dive_log_buddies enable row level security;

-- SELECT: 親 dive が閲覧可能（所有者 or 公開・未削除）、または自分宛タグ（本人による管理用）
create policy "read buddies of viewable dives"
    on public.dive_log_buddies for select
    using (
        exists (
            select 1 from public.dives d
            where d.id = dive_id
              and (d.user_id = (select auth.uid()) or (d.is_public = true and d.deleted_at is null))
        )
        or buddy_user_id = (select auth.uid())
    );

-- INSERT: dive 所有者のみ
create policy "dive owner can add buddies"
    on public.dive_log_buddies for insert
    with check (
        exists (
            select 1 from public.dives d
            where d.id = dive_id and d.user_id = (select auth.uid())
        )
    );

-- UPDATE: タグ付けされた本人が自分宛タグを除去（removed_by_buddy 更新）
create policy "buddy can opt out own tag"
    on public.dive_log_buddies for update
    using (buddy_user_id = (select auth.uid()))
    with check (buddy_user_id = (select auth.uid()));

-- DELETE: dive 所有者のみ、かつ本人除去済みでない行（除去済みは残し再タグ付けをブロック）
create policy "dive owner can delete non-optout buddies"
    on public.dive_log_buddies for delete
    using (
        removed_by_buddy = false
        and exists (
            select 1 from public.dives d
            where d.id = dive_id and d.user_id = (select auth.uid())
        )
    );
