-- ========================================
-- get_public_dive 関数の廃止（spec 021 更新）
-- 匿名共有ページ /(public)/shared/dives/[slug] を廃止し、公開ログの閲覧は
-- 認証ユーザー向けの /dives/[id]（RLS: authenticated can read public dives）へ統合した。
-- slug ベースの匿名 RPC は不要になったため削除する。
-- 注: public_slug カラム・is_public 読み取りポリシー・idx_dives_public_slug は
-- 影響範囲を広げないため残置する（共有リンクは dive id ベースに変更済み）。
-- ========================================
drop function if exists public.get_public_dive(text);
