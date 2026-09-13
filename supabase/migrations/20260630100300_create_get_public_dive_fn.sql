-- ========================================
-- get_public_dive 関数（spec 021 FR-011 / contracts/public-dive-rpc）
-- 匿名（未ログイン）の共有ページ用。公開ログ 1 件のみを slug で返す。
-- テーブル RLS を anon に広げず、is_public=true の行だけを最小列で公開して
-- 列挙耐性を保つ（research R2 / SC-002）。
-- ========================================
create or replace function public.get_public_dive(p_slug text)
returns table (
    id uuid,
    dive_date date,
    location text,
    max_depth_m numeric,
    bottom_time_min integer,
    notes text,
    owner_nickname text
)
language sql
security definer
set search_path = ''
stable
as $$
    select d.id, d.dive_date, d.location, d.max_depth_m, d.bottom_time_min, d.notes,
           ud.nickname as owner_nickname
    from public.dives d
    join public.user_details ud on ud.user_id = d.user_id
    where d.public_slug = p_slug
      and d.is_public = true
      and d.deleted_at is null;
$$;

revoke all on function public.get_public_dive(text) from public;
grant execute on function public.get_public_dive(text) to anon, authenticated;

comment on function public.get_public_dive(text) is
    '公開ログ 1 件を slug で返す（is_public=true のみ）。匿名共有ページ用';
