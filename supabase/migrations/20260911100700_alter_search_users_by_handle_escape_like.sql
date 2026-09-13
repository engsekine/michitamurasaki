-- ========================================
-- search_users_by_handle の LIKE ワイルドカードをエスケープ（セキュリティ監査対応 2026-09）
--
-- 問題: p_query を `'%' || trim(p_query) || '%'` のまま ilike に渡していたため、
--       `%` や `_` を含む検索語で全ユーザーが handle 昇順に最大 50 件返り、
--       `a%`, `b%`… と分割すれば全 handle / nickname を機械的に列挙できた。
--
-- 対応: `\` `%` `_` をエスケープし、入力文字そのものの部分一致だけを返す。
-- ========================================

create or replace function public.search_users_by_handle(p_query text, p_limit integer default 20)
returns table (user_id uuid, nickname text, handle text)
language sql
stable
security definer
set search_path = ''
as $$
    select ud.user_id, ud.nickname, ud.handle
    from public.user_details ud
    where length(trim(coalesce(p_query, ''))) > 0
      and ud.handle ilike
          '%' || replace(replace(replace(trim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
          escape '\'
      and ud.user_id is distinct from (select auth.uid())
    order by ud.handle asc
    limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

comment on function public.search_users_by_handle(text, integer) is
    'ユーザー ID（handle）部分一致でユーザー（user_id, nickname, handle）を返す。フォロー相手を探すユーザー検索用。呼び出し元自身は除外。ワイルドカード文字はエスケープする';
