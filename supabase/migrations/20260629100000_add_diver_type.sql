-- ========================================
-- 019-diver-type: ダイバー種別・ダイバー番号の登録
--
-- 1) user_details に diver_type / diver_number を追加（既存ユーザーは NULL で grandfather）
--    CHECK ①種別 enum ②番号長 1..50 ③番号は instructor のときのみ非 NULL
-- 2) handle_new_user() を再定義（016/018 の ? 'nickname' 分岐を維持）し、
--    メール経路の user_details INSERT に diver_type / diver_number を追記。
--    番号は diver_type='instructor' のときのみ（CHECK ③整合）。
-- ========================================

-- ----------------------------------------
-- 1) 列追加 + CHECK
-- ----------------------------------------
alter table public.user_details
    add column diver_type text,
    add column diver_number text;

comment on column public.user_details.diver_type is 'ダイバー種別。instructor / general。新規登録では必須・既存は NULL（grandfather）';
comment on column public.user_details.diver_number is 'ダイバー番号（認定番号等）。インストラクターのみ・任意・50 文字以内。それ以外は NULL';

alter table public.user_details
    add constraint user_details_diver_type_check
    check (diver_type is null or diver_type in ('instructor', 'general'));

alter table public.user_details
    add constraint user_details_diver_number_length_check
    check (diver_number is null or char_length(trim(diver_number)) between 1 and 50);

-- 番号は instructor のときのみ保持できる（一般ダイバー/未設定では NULL）
alter table public.user_details
    add constraint user_details_diver_number_instructor_check
    check (diver_number is null or diver_type = 'instructor');

-- ----------------------------------------
-- 2) handle_new_user() 再定義（016/018 の分岐 + terms を維持し diver_* を追記）
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
            diver_number
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
            end
        );
    end if;

    return new;
end;
$$;
