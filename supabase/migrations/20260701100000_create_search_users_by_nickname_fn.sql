-- ========================================
-- search_users_by_nickname 関数（spec 021 / ユーザー検索・フォロー導線）
-- user_details は本人のみ SELECT 可（PII を含む）。フォロー相手を探す「ユーザー検索」では
-- nickname の部分一致で他ユーザーを引く必要があるため、nickname だけを返す
-- SECURITY DEFINER 関数として最小限に公開する（get_user_public_profiles と同方針）。
--
-- - 大文字小文字を無視した部分一致（ilike）。空クエリは 0 件。
-- - 呼び出し元自身は結果から除外する。
-- - nickname 昇順で最大 p_limit 件（既定 20・上限 50）を返す。
-- ========================================
create or replace function public.search_users_by_nickname(p_query text, p_limit integer default 20)
returns table (
    user_id uuid,
    nickname text
)
language sql
security definer
set search_path = ''
stable
as $$
    select ud.user_id, ud.nickname
    from public.user_details ud
    where length(trim(coalesce(p_query, ''))) > 0
      and ud.nickname ilike '%' || trim(p_query) || '%'
      and ud.user_id is distinct from (select auth.uid())
    order by ud.nickname asc
    limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke all on function public.search_users_by_nickname(text, integer) from public;
grant execute on function public.search_users_by_nickname(text, integer) to authenticated;

comment on function public.search_users_by_nickname(text, integer) is
    'nickname 部分一致でユーザー（user_id, nickname）を返す。フォロー相手を探すユーザー検索用。呼び出し元自身は除外';
