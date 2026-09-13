-- ========================================
-- 既存オブジェクトの掃除（冪等性確保）
-- 開発中の再適用時にトリガー重複エラーが出ないように先に落とす
-- ========================================
-- drop if exists の空振り時に出る「does not exist, skipping」NOTICE を抑制する
-- （set local のためこのマイグレーションのトランザクション内のみ有効）
set local client_min_messages = warning;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop table if exists public.user_details cascade;

-- ========================================
-- user_details テーブル
-- users と 1:1 で紐づくプロフィール属性を保持
-- サインアップ時に姓名（漢字 / ローマ字）、ニックネーム、生年月日を必須項目として収集する
-- ========================================
create table public.user_details (
    user_id uuid primary key references public.users(id) on delete cascade,
    last_name text not null check (length(trim(last_name)) > 0),
    first_name text not null check (length(trim(first_name)) > 0),
    last_name_romaji text not null check (length(trim(last_name_romaji)) > 0),
    first_name_romaji text not null check (length(trim(first_name_romaji)) > 0),
    nickname text not null check (length(trim(nickname)) > 0),
    birth_on date not null check (birth_on >= '1900-01-01' and birth_on <= current_date),
    gender text not null default 'unanswered' check (gender in ('male', 'female', 'unanswered')),
    height_cm numeric(5, 2) check (height_cm > 0 and height_cm <= 300),
    weight_kg numeric(5, 2) check (weight_kg > 0 and weight_kg <= 500),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.user_details is 'ユーザーの詳細プロフィール。users と 1:1';
comment on column public.user_details.last_name is '姓（漢字 / 表示用）。サインアップ時必須';
comment on column public.user_details.first_name is '名（漢字 / 表示用）。サインアップ時必須';
comment on column public.user_details.last_name_romaji is '姓（ローマ字）。サインアップ時必須';
comment on column public.user_details.first_name_romaji is '名（ローマ字）。サインアップ時必須';
comment on column public.user_details.nickname is 'ニックネーム（表示用）。サインアップ時必須';
comment on column public.user_details.birth_on is '生年月日。サインアップ時必須。1900-01-01 〜 当日';
comment on column public.user_details.gender is '性別。male / female / unanswered の 3 値。未選択時は unanswered';
comment on column public.user_details.height_cm is '身長（cm）。0 < height_cm <= 300 の範囲。任意入力';
comment on column public.user_details.weight_kg is '体重（kg）。0 < weight_kg <= 500 の範囲。任意入力';

-- updated_at 自動更新（handle_updated_at は users マイグレーションで定義済み）
create trigger user_details_handle_updated_at
    before update on public.user_details
    for each row
    execute function public.handle_updated_at();

-- ========================================
-- Auth signup フック
-- auth.users に挿入されたとき、public.users と public.user_details に自動挿入する。
-- 姓名は auth.signUp の options.data 経由で
-- auth.users.raw_user_meta_data に格納されるため、そこから取り出す。
-- security definer で RLS をバイパス。search_path 固定（injection 対策）。
-- ========================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
    insert into public.users (id) values (new.id);
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
    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- ========================================
-- RLS
-- 自分のレコードのみ参照・更新可
-- insert は handle_new_user（security definer）経由のため policy 不要
-- ========================================
alter table public.user_details enable row level security;

create policy "users can view own details"
    on public.user_details for select
    using ((select auth.uid()) = user_id);

create policy "users can update own details"
    on public.user_details for update
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);
