-- ========================================
-- get_dive_stats の訪問スポット数をダイブサイト参照込みに修正（監査対応）
--
-- 問題: count(distinct location) は 011 の排他 CHECK
--       （サイト参照時は location = null）導入後、マスタサイトで登録した
--       ログを一切カウントせず、訪問スポット数が過少になる。
--
-- 対応: サイト参照（dive_site_id）と自由入力（location）を合わせて distinct カウントする。
-- 仕様: specs/003-dashboard/spec.md FR-003（サイト参照 or 自由入力の distinct と更新）
-- ========================================

create or replace function public.get_dive_stats()
returns table (
    total_dives bigint,
    total_bottom_time_min bigint,
    max_depth_m numeric,
    visited_locations bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
    select
        count(*),
        coalesce(sum(bottom_time_min), 0),
        coalesce(max(max_depth_m), 0),
        count(distinct coalesce(dive_site_id::text, location))
    from public.dives
    where user_id = (select auth.uid());
$$;

comment on function public.get_dive_stats() is
    'TOP ダッシュボードの累計統計（本数 / 潜水時間 / 最大水深 / 訪問スポット数）。本人限定は関数内の where 句が保証する（RLS は公開ログの読み取りも許可するため単独では不十分）';
