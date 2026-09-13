-- ========================================
-- dive_shops テーブル
-- ユーザーが登録するダイビングショップ（本人のみ参照可のプライベートデータ）
-- 1 ユーザー : 多 dive_shops
-- 仕様: specs/033-dive-shops/data-model.md
-- ========================================

create table public.dive_shops (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users(id) on delete cascade,

    name text not null check (length(trim(name)) > 0 and char_length(name) <= 120),
    address text not null default '' check (char_length(address) <= 255),
    phone text not null default '' check (char_length(phone) <= 20),
    website_url text not null default '' check (char_length(website_url) <= 2048),
    memo text not null default '' check (char_length(memo) <= 1000),

    -- 住所のジオコーディング結果。導出値だが外部 API（Google Geocoding）の解決結果で
    -- 再現性がないため冗長保存し、表示時の外部 API 依存をなくす（research.md Decision 2）
    latitude numeric(8, 6) check (latitude is null or (latitude >= -90 and latitude <= 90)),
    longitude numeric(9, 6) check (longitude is null or (longitude >= -180 and longitude <= 180)),

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.dive_shops is 'ユーザーが登録するダイビングショップ（本人のみ参照可のプライベートデータ）';
comment on column public.dive_shops.phone is '電話番号。形式検証（数字・ハイフン・+）はアプリ側 yup で行う';
comment on column public.dive_shops.latitude is '住所のジオコーディング結果（Google Geocoding API）。解決失敗・住所未入力時は null';
comment on column public.dive_shops.longitude is '住所のジオコーディング結果。latitude とセットで null / 非 null が揃う';

create index idx_dive_shops_user_id on public.dive_shops(user_id);

create trigger dive_shops_handle_updated_at
    before update on public.dive_shops
    for each row
    execute function public.handle_updated_at();

alter table public.dive_shops enable row level security;

create policy "users can read own dive shops"
    on public.dive_shops for select
    using ((select auth.uid()) = user_id);

create policy "users can insert own dive shops"
    on public.dive_shops for insert
    with check ((select auth.uid()) = user_id);

create policy "users can update own dive shops"
    on public.dive_shops for update
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

create policy "users can delete own dive shops"
    on public.dive_shops for delete
    using ((select auth.uid()) = user_id);
