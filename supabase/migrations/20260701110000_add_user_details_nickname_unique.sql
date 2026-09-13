-- nickname に一意制約を付ける（spec 021 / フォロー・検索の表示名の曖昧さ解消）。
-- 表示名は大文字小文字・前後空白の違いで重複扱いにしないよう、正規化キー lower(trim(nickname)) で一意化する
-- （ユーザー検索の ilike 部分一致とも整合）。
--
-- 事前に重複が無いことを確認済み（重複があるとこの index 作成は失敗する）。
create unique index user_details_nickname_key
    on public.user_details (lower(trim(nickname)));

comment on index public.user_details_nickname_key is
    'nickname の一意制約（大文字小文字・前後空白を正規化した表示名で重複を禁止）';

-- ニックネームの使用可否を判定する関数（サインアップ／プロフィール補完・編集の事前チェック用）。
-- user_details は本人のみ SELECT 可（PII）だが、可否判定には他ユーザーの nickname 照合が必要なため
-- SECURITY DEFINER で「取得済みか（boolean）」だけを返す（nickname 実体は返さない）。
-- p_exclude_user_id を渡すと自分自身の行は衝突判定から除外する（プロフィール編集で自分の名前を維持できる）。
-- サインアップ時は anon から呼ばれるため anon にも実行権限を付与する。
create or replace function public.is_nickname_taken(p_nickname text, p_exclude_user_id uuid default null)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
    select exists (
        select 1
        from public.user_details ud
        where lower(trim(ud.nickname)) = lower(trim(p_nickname))
          and ud.user_id is distinct from p_exclude_user_id
    );
$$;

revoke all on function public.is_nickname_taken(text, uuid) from public;
grant execute on function public.is_nickname_taken(text, uuid) to anon, authenticated;

comment on function public.is_nickname_taken(text, uuid) is
    'nickname が既に使われているかを返す（大文字小文字・前後空白を無視）。p_exclude_user_id は衝突判定から除外する自分の user_id';
