-- ========================================
-- 026-log-monetization: 新規ユーザーへ初期ログ枠 10 を付与（FR-008）
--
-- handle_new_user（最終更新: 20260701120000_add_email_opt_in.sql）に
-- apply_credit_ledger_entry による initial_grant を追加する。
-- 既存の users / user_details 作成ロジックは変更しない。
-- ========================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
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
