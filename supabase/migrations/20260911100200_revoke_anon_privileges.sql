-- ========================================
-- anon ロールの権限縮小（セキュリティ監査対応 2026-09）
--
-- 問題:
--   1. 20260702130000 で anon にも全テーブルの SELECT/INSERT/UPDATE/DELETE を付与しており、
--      RLS が唯一の防波堤になっていた。anon の正当な操作は security definer 関数
--      （submit_inquiry / discard_recent_inquiry / is_nickname_taken / is_handle_taken）のみで、
--      テーブル権限は不要（definer 関数は所有者権限で実行される）。
--      将来 RLS 漏れのテーブルや to 句なしの `using (true)` ポリシーが 1 つ入った時点で
--      anon から全行が見える構造だったため、多層防御として権限自体を剥奪する。
--   2. 関数の EXECUTE は `revoke ... from public` のみで剥奪していた箇所が多いが、
--      Supabase の既定権限（alter default privileges ... grant all on functions to anon, authenticated, ...）
--      では anon / authenticated への EXECUTE は PUBLIC 経由ではなく個別付与のため、
--      `from public` では剥がれず anon に EXECUTE が残っていた（get_user_public_profiles /
--      search_users_by_handle / get_user_id_by_handle 等を匿名で呼べる = ユーザー列挙）。
--      また 20260717100000 の grant_daily_bonus 再作成で service_role の EXECUTE が落ちていた。
--
-- 対応:
--   - anon からテーブル・シーケンスの DML 権限を剥奪し、今後作成分にも付与しない
--   - 関数の既定 EXECUTE 付与（anon / authenticated / PUBLIC）を止め、
--     anon が呼ぶ必要のない関数から anon の EXECUTE を剥奪する
--     （RLS ポリシー式・RPC から呼ばれる関数は authenticated に明示付与して維持）
--   - 今後作成する関数は、呼び出しロールへ明示的に grant execute する運用に切り替える
-- ========================================

-- 1. テーブル・シーケンス: anon の権限を全て剥奪
--    （DML に加え、既定権限で付いていた TRUNCATE / REFERENCES / TRIGGER も含む。
--      TRUNCATE は RLS の対象外なので API ロールに残してはいけない）
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges for role postgres in schema public
    revoke all on tables from anon;
alter default privileges for role postgres in schema public
    revoke all on sequences from anon;

-- 1'. authenticated も DML 以外（TRUNCATE / REFERENCES / TRIGGER）は不要なので剥奪する
revoke truncate, references, trigger on all tables in schema public from authenticated;
alter default privileges for role postgres in schema public
    revoke truncate, references, trigger on tables from authenticated;

-- 2. 関数: 既定の EXECUTE 自動付与を止める（今後の関数は明示 grant が必要）
alter default privileges for role postgres in schema public
    revoke execute on functions from anon, authenticated, public;

-- 3. anon が呼ぶ必要のない関数から anon / PUBLIC の EXECUTE を剥奪
revoke execute on function public.get_user_public_profiles(uuid[]) from anon, public;
revoke execute on function public.get_user_id_by_handle(text) from anon, public;
revoke execute on function public.search_users_by_handle(text, integer) from anon, public;
revoke execute on function public.is_public_dive_photo(text) from anon, public;
revoke execute on function public.is_admin() from anon, public;
revoke execute on function public.is_superadmin() from anon, public;
revoke execute on function public.get_dive_stats() from anon, public;
revoke execute on function public.get_dive_yearly_counts() from anon, public;
revoke execute on function public.get_dive_monthly_stats(integer) from anon, public;
revoke execute on function public.grant_daily_bonus() from anon, public;

-- 4. authenticated（RLS ポリシー式・RPC の呼び出しロール）には明示的に維持する
grant execute on function public.is_public_dive_photo(text) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_superadmin() to authenticated;
grant execute on function public.get_dive_stats() to authenticated;
grant execute on function public.get_dive_yearly_counts() to authenticated;
grant execute on function public.get_dive_monthly_stats(integer) to authenticated;
grant execute on function public.get_user_public_profiles(uuid[]) to authenticated;
grant execute on function public.get_user_id_by_handle(text) to authenticated;
grant execute on function public.search_users_by_handle(text, integer) to authenticated;
grant execute on function public.grant_daily_bonus() to authenticated;

-- 5. 20260717100000 で落ちた service_role の EXECUTE を復旧（data-model.md の権限表）
grant execute on function public.grant_daily_bonus() to service_role;
