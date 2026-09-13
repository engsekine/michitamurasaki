-- ========================================
-- get_dive_monthly_stats(months_back) RPC の集計列を変更する
-- TOP「統計の推移」の刷新（feat/design-change）に伴い、
-- 平均水温・月内最大深度（コンディション記録系）の集計をやめ、月別の本数のみを返す。
-- 戻り値の列構成が変わるため drop してから作り直す（create or replace は戻り値型を変更できない）。
-- security invoker + RLS により呼び出しユーザーのデータのみ集計される
-- 仕様: specs/010-stats-expansion/data-model.md
-- ========================================

drop function if exists public.get_dive_monthly_stats(integer);

create function public.get_dive_monthly_stats(months_back integer default 12)
returns table (
    month text,
    dive_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
    select
        to_char(dive_date, 'YYYY-MM'),
        count(*)
    from public.dives
    where user_id = (select auth.uid())
      and dive_date >= date_trunc('month', current_date) - make_interval(months => greatest(months_back, 1) - 1)
    group by 1
    order by 1;
$$;

comment on function public.get_dive_monthly_stats(integer) is '統計の推移（月別ダイビング本数）。現在月から遡って months_back ヶ月分のうち記録のある月のみ返す';
