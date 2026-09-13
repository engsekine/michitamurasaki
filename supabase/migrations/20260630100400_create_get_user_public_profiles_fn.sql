-- ========================================
-- get_user_public_profiles 関数（spec 021）
-- user_details は本人のみ SELECT 可（PII: 生年月日・性別・身長体重を含む）。
-- ソーシャル機能（バディ表示・プロフィール・タイムライン・フォロー一覧）では
-- 他ユーザーの「表示名（nickname）」だけが必要なため、nickname のみを返す
-- SECURITY DEFINER 関数で最小限に公開する（行/列レベルの情報漏えいを防ぐ）。
-- ========================================
create or replace function public.get_user_public_profiles(p_ids uuid[])
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
    where ud.user_id = any(p_ids);
$$;

revoke all on function public.get_user_public_profiles(uuid[]) from public;
grant execute on function public.get_user_public_profiles(uuid[]) to authenticated;

comment on function public.get_user_public_profiles(uuid[]) is
    '指定ユーザーの公開プロフィール（user_id, nickname のみ）を返す。ソーシャル表示用に nickname だけを安全に公開する';
