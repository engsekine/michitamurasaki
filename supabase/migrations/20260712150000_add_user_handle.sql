-- ========================================
-- ユーザー ID（handle）の導入（034 Rev.2）
-- プロフィール URL の識別子として、英語のみのユーザー ID を user_details に追加する。
-- 既存ユーザーには自動採番（user-<uuid 先頭 8 桁>）で backfill し、全ユーザーが必ず持つ状態にする。
-- 仕様: specs/034-profile-user-id/data-model.md
-- ========================================

-- drop if exists の空振り時に出る「does not exist, skipping」NOTICE を抑制する
-- （set local のためこのマイグレーションのトランザクション内のみ有効）
set local client_min_messages = warning;

-- Rev.1（ニックネーム URL・未リリース）の解決関数を適用済みローカル DB から掃除する
drop function if exists public.get_user_id_by_nickname(text);

-- 1) カラム追加（backfill のため一旦 nullable）
alter table public.user_details
    add column handle text;

comment on column public.user_details.handle is
    'プロフィール URL に使うユーザー ID（034）。小文字英数字と - _、3〜30 文字・先頭英字・一意';

-- 2) 既存ユーザーへ自動採番（uuid 先頭 8 桁。実用上一意で、万一の重複は後続の一意インデックスで検出）
update public.user_details
set handle = 'user-' || substr(replace(user_id::text, '-', ''), 1, 8)
where handle is null;

-- 3) 制約を確定する
alter table public.user_details
    alter column handle set not null;

alter table public.user_details
    add constraint user_details_handle_format_check check (handle ~ '^[a-z][a-z0-9_-]{2,29}$');

create unique index user_details_handle_key on public.user_details (handle);

-- 4) handle_new_user: サインアップ meta の handle を保存する（欠落時は自動採番と同じ規則）
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.users (id) values (new.id);

    -- 初期ログ枠 10 を付与する（026 / FR-008）。
    -- 値は service-front/src/features/credits/constants.ts の INITIAL_GRANT_AMOUNT と同期
    perform public.apply_credit_ledger_entry(new.id, 'initial_grant', 10);

    -- メールサインアップ経路のみ user_details を作成する（016）。
    -- OAuth 初回（nickname 等が無い）は作らず、/profile-completion で補完する。
    if new.raw_user_meta_data ? 'nickname' then
        insert into public.user_details (
            user_id,
            last_name,
            first_name,
            last_name_romaji,
            first_name_romaji,
            nickname,
            handle,
            birth_on,
            gender,
            height_cm,
            weight_kg,
            terms_version,
            terms_agreed_at,
            diver_type,
            diver_number,
            is_email_opted_in,
            email_opted_in_at
        )
        values (
            new.id,
            new.raw_user_meta_data->>'last_name',
            new.raw_user_meta_data->>'first_name',
            new.raw_user_meta_data->>'last_name_romaji',
            new.raw_user_meta_data->>'first_name_romaji',
            new.raw_user_meta_data->>'nickname',
            -- ユーザー ID（034）。meta 欠落時（旧 seed 等）は backfill と同じ規則で採番する
            coalesce(
                nullif(new.raw_user_meta_data->>'handle', ''),
                'user-' || substr(replace(new.id::text, '-', ''), 1, 8)
            ),
            (new.raw_user_meta_data->>'birth_on')::date,
            coalesce(new.raw_user_meta_data->>'gender', 'unanswered'),
            nullif(new.raw_user_meta_data->>'height_cm', '')::numeric,
            nullif(new.raw_user_meta_data->>'weight_kg', '')::numeric,
            new.raw_user_meta_data->>'terms_version',
            -- terms_version がある場合のみ now()。無条件 now() だと CHECK 違反になりうる。
            case when new.raw_user_meta_data ? 'terms_version' then now() else null end,
            new.raw_user_meta_data->>'diver_type',
            -- 番号は instructor のときのみ（空文字は NULL に正規化）
            case
                when new.raw_user_meta_data->>'diver_type' = 'instructor'
                    then nullif(new.raw_user_meta_data->>'diver_number', '')
                else null
            end,
            -- 配信許可（022）。メタ欠落時は false。signUp が options.data.email_opt_in で渡す。
            coalesce((new.raw_user_meta_data->>'email_opt_in')::boolean, false),
            -- 許可時のみ now()。不許可（false）は NULL にして CHECK を満たす。
            case when (new.raw_user_meta_data->>'email_opt_in')::boolean then now() else null end
        );
    end if;

    return new;
end;
$$;

-- 5) handle → user_id の解決（プロフィール URL。034 / FR-001・FR-005）
create or replace function public.get_user_id_by_handle(p_handle text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
    select user_id
    from public.user_details
    where handle = lower(trim(p_handle))
    limit 1;
$$;

comment on function public.get_user_id_by_handle(text) is
    'プロフィール URL のユーザー ID 解決（034）。小文字正規化して照合し user_id を返す';

revoke all on function public.get_user_id_by_handle(text) from public;
grant execute on function public.get_user_id_by_handle(text) to authenticated;

-- 6) 重複の事前チェック（登録・変更フォーム用。is_nickname_taken と同じ位置づけ）
create or replace function public.is_handle_taken(p_handle text, p_exclude_user_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.user_details
        where handle = lower(trim(p_handle))
          and (p_exclude_user_id is null or user_id <> p_exclude_user_id)
    );
$$;

comment on function public.is_handle_taken(text, uuid) is
    'ユーザー ID の重複チェック（034）。変更時は p_exclude_user_id で自分を除外する';

revoke all on function public.is_handle_taken(text, uuid) from public;
-- サインアップ（未認証）での事前チェックに使うため anon にも付与する
grant execute on function public.is_handle_taken(text, uuid) to anon, authenticated;

-- 7) 公開プロフィール要約に handle を追加（リンク生成用。戻り値変更のため作り直す）
drop function if exists public.get_user_public_profiles(uuid[]);

create or replace function public.get_user_public_profiles(p_ids uuid[])
returns table (user_id uuid, nickname text, handle text)
language sql
stable
security definer
set search_path = ''
as $$
    select ud.user_id, ud.nickname, ud.handle
    from public.user_details ud
    where ud.user_id = any(p_ids);
$$;

revoke all on function public.get_user_public_profiles(uuid[]) from public;
grant execute on function public.get_user_public_profiles(uuid[]) to authenticated;

-- 8) ユーザー検索にも handle を追加（検索結果のプロフィールリンク生成用。戻り値変更のため作り直す）
drop function if exists public.search_users_by_nickname(text, integer);

create or replace function public.search_users_by_nickname(p_query text, p_limit integer default 20)
returns table (user_id uuid, nickname text, handle text)
language sql
stable
security definer
set search_path = ''
as $$
    select ud.user_id, ud.nickname, ud.handle
    from public.user_details ud
    where length(trim(coalesce(p_query, ''))) > 0
      and ud.nickname ilike '%' || trim(p_query) || '%'
      and ud.user_id is distinct from (select auth.uid())
    order by ud.nickname asc
    limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke all on function public.search_users_by_nickname(text, integer) from public;
grant execute on function public.search_users_by_nickname(text, integer) to authenticated;
