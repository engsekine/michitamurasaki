-- ========================================
-- API ロールへのテーブル権限を明示付与する（Supabase CLI 仕様変更対応）
--
-- 背景: Supabase CLI v2.10x 以降、db reset / start 時にマイグレーション適用前へ
--   alter default privileges for role postgres in schema public
--     revoke select, insert, update, delete on tables from anon, authenticated, service_role;
-- が実行され、マイグレーションで作成したテーブルに API ロールへの自動 GRANT が
-- 付与されなくなった。本プロジェクトのマイグレーションは旧デフォルト
-- （全ロールに付与 + RLS でアクセス制御）に依存していたため、リセット後は
-- 全テーブルが permission denied (42501) となり、ログイン後の一覧取得・
-- Google 認証のプロフィール補完（user_details INSERT）等がすべて失敗していた。
--
-- 対応: 旧デフォルトと同等のテーブル・シーケンス権限を明示付与する。
-- アクセス制御は従来どおり RLS が担う（anon は該当ポリシーが無い限り行は見えない）。
-- 関数はここで一括付与しない: 既存マイグレーションが関数ごとに revoke/grant を
-- 明示管理しており、一括付与はセキュリティ監査（211c76c）の対応を巻き戻すため。
-- ========================================

-- 既存テーブル・シーケンスへ付与
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

-- 本マイグレーション以降に作成されるテーブル・シーケンスにも自動付与する
alter default privileges for role postgres in schema public
    grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
    grant usage, select on sequences to anon, authenticated, service_role;
