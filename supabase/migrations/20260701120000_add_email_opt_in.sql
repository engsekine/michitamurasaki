-- ========================================
-- 022-email-consent: メール配信許可（オプトイン）の記録
--
-- 1) user_details に配信同意用の 2 列を追加（既存ユーザーは false / NULL で grandfather）。
--    CHECK で「許可=日時あり / 不許可=日時 NULL」を保証し、片方だけ埋まる不整合を防ぐ。
-- 2) handle_new_user() を再定義（016 の ? 'nickname' 分岐・018 の terms 列・019 の diver 列を維持）し、
--    メール経路の user_details INSERT に is_email_opted_in / email_opted_in_at を追記。
--    email_opted_in_at は email_opt_in が真のときのみ now()（無条件 now() は不許可時に
--    CHECK 違反でサインアップを壊すため条件付き）。メタ欠落時は coalesce で false 扱い。
-- ========================================

-- ----------------------------------------
-- 1) 列追加 + CHECK
-- ----------------------------------------
alter table public.user_details
    add column is_email_opted_in boolean not null default false,
    add column email_opted_in_at timestamptz;

comment on column public.user_details.is_email_opted_in is 'お知らせメール（任意配信）の配信を許可しているか。既存ユーザー・未選択は false';
comment on column public.user_details.email_opted_in_at is '配信を許可した日時。不許可（false）のときは NULL';

-- 許可（true）なら日時を持ち、不許可（false）なら日時は NULL。片方だけ埋まる不整合を防ぐ。
alter table public.user_details
    add constraint user_details_email_opt_in_check
    check (is_email_opted_in = (email_opted_in_at is not null));

-- ----------------------------------------
-- 2) handle_new_user() 再定義
--    016 の分岐（メール経路のみ user_details を作成）・018 の terms 列・019 の diver 列を
--    維持したうえで、配信同意（022）を追記する。security definer / search_path 固定は維持。
-- ----------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
    insert into public.users (id) values (new.id);

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
