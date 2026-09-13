-- ========================================
-- 016-google-login: OAuth サインアップ対応
--
-- 1) handle_new_user() を分岐させる
--    Google OAuth の初回サインアップでは raw_user_meta_data に
--    user_details の必須項目（nickname / birth_on 等）が存在しないため、
--    そのまま INSERT すると NOT NULL / CHECK 制約違反で auth.users への
--    INSERT 自体が失敗する。これを防ぐため、user_details の挿入は
--    メールサインアップ経路（raw_user_meta_data ? 'nickname'）のみに限定する。
--    OAuth 初回は user_details 行を作らず「未補完」を表し、
--    /profile-completion での補完時にアプリから INSERT する。
--
-- 2) user_details に INSERT 用 RLS ポリシーを追加する
--    補完フォーム（completeProfile）が本人行を INSERT できるようにする。
--    PK = user_id と with check で他人行の作成・重複を構造的に防ぐ。
-- ========================================

-- ----------------------------------------
-- 1) handle_new_user() の分岐
--    security definer / search_path 固定は維持（injection 対策）
-- ----------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
    insert into public.users (id) values (new.id);

    -- メールサインアップ経路のみ user_details を作成する。
    -- OAuth 初回（nickname 等が無い）は作らず、/profile-completion で補完する。
    if new.raw_user_meta_data ? 'nickname' then
        insert into public.user_details (
            user_id,
            last_name,
            first_name,
            last_name_romaji,
            first_name_romaji,
            nickname,
            birth_on,
            gender,
            height_cm,
            weight_kg
        )
        values (
            new.id,
            new.raw_user_meta_data->>'last_name',
            new.raw_user_meta_data->>'first_name',
            new.raw_user_meta_data->>'last_name_romaji',
            new.raw_user_meta_data->>'first_name_romaji',
            new.raw_user_meta_data->>'nickname',
            (new.raw_user_meta_data->>'birth_on')::date,
            coalesce(new.raw_user_meta_data->>'gender', 'unanswered'),
            nullif(new.raw_user_meta_data->>'height_cm', '')::numeric,
            nullif(new.raw_user_meta_data->>'weight_kg', '')::numeric
        );
    end if;

    return new;
end;
$$;

-- ----------------------------------------
-- 2) user_details の INSERT ポリシー
--    補完フォームから本人行のみ作成可能にする。
--    auth.uid() は (select ...) で包む（auth_rls_initplan 対策）。
-- ----------------------------------------
create policy "users can insert own details"
    on public.user_details for insert
    with check ((select auth.uid()) = user_id);
