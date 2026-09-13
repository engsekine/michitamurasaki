-- ========================================
-- ユーザー検索をユーザー ID（handle）検索に変更
-- 「ユーザーを探す」（/users/search）の検索キーを nickname 部分一致から
-- handle 部分一致へ切り替える。nickname は表示専用となり検索には使わない。
-- user_details は本人のみ SELECT 可（PII を含む）ため、旧関数と同じく
-- 最小限のカラムだけを返す SECURITY DEFINER 関数として公開する。
--
-- - 大文字小文字を無視した部分一致（ilike。handle は小文字のみだが入力は大文字も許容）
-- - 空クエリは 0 件。呼び出し元自身は結果から除外する。
-- - handle 昇順で最大 p_limit 件（既定 20・上限 50）を返す。
-- ========================================

-- 旧: nickname 部分一致の検索関数は廃止する
drop function if exists public.search_users_by_nickname(text, integer);

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
      and ud.handle ilike '%' || trim(p_query) || '%'
      and ud.user_id is distinct from (select auth.uid())
    order by ud.handle asc
    limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

comment on function public.search_users_by_handle(text, integer) is
    'ユーザー ID（handle）部分一致でユーザー（user_id, nickname, handle）を返す。フォロー相手を探すユーザー検索用。呼び出し元自身は除外';

revoke all on function public.search_users_by_handle(text, integer) from public;
grant execute on function public.search_users_by_handle(text, integer) to authenticated;
