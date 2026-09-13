-- ========================================
-- 018-terms-agreement: 新規登録時の利用規約同意の記録
--
-- 1) user_details に同意記録用の 2 列を追加（既存ユーザーは NULL で grandfather）
--    CHECK で「両方 NULL または両方 NOT NULL」を保証し、片方だけ埋まる不整合を防ぐ。
-- 2) handle_new_user() を再定義（016 の ? 'nickname' 分岐を維持）し、
--    メール経路の user_details INSERT に terms_version / terms_agreed_at を追記。
--    terms_agreed_at は terms_version がある場合のみ now()（無条件 now() は
--    terms_version 欠落時に CHECK 違反でサインアップを壊すため条件付き）。
-- ========================================

-- ----------------------------------------
-- 1) 列追加 + CHECK
-- ----------------------------------------
alter table public.user_details
    add column terms_version text,
    add column terms_agreed_at timestamptz;

comment on column public.user_details.terms_version is '同意した利用規約のバージョン（例 2026-06-26）。feature 以前の登録は NULL';
comment on column public.user_details.terms_agreed_at is '利用規約に同意した日時。feature 以前の登録は NULL';

alter table public.user_details
    add constraint user_details_terms_agreement_check
    check ((terms_version is null) = (terms_agreed_at is null));

-- terms_version は NULL もしくは YYYY-MM-DD 形式のみ許可（空文字列・不正値を弾く）。
-- アプリは CURRENT_TERMS_VERSION 定数のみ渡すが、DB 直接操作・将来の管理ツール経由の不正値を防ぐ。
alter table public.user_details
    add constraint user_details_terms_version_format_check
    check (terms_version is null or terms_version ~ '^\d{4}-\d{2}-\d{2}$');

-- ----------------------------------------
-- 2) handle_new_user() 再定義
--    016 の分岐（メール経路のみ user_details を作成）を維持し、同意情報を追記。
--    security definer / search_path 固定は維持。
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
            terms_agreed_at
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
            case when new.raw_user_meta_data ? 'terms_version' then now() else null end
        );
    end if;

    return new;
end;
$$;
