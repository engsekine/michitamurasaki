-- ========================================
-- is_public_dive_photo にソフトデリート判定を追加（セキュリティ監査対応）
--
-- 問題: Storage ポリシーの公開判定関数が d.is_public のみを見ており、
--       管理画面で論理削除された公開ログの写真オブジェクト（display / thumb）が
--       パスを知っていれば anon から取得可能なまま残る
--       （テーブル側の SELECT ポリシーは 20260620100500 で修正済み・Storage 側の対応漏れ）。
--
-- 仕様: specs/012-photo-attachments/data-model.md / specs/015-admin-panel/data-model.md
-- ========================================

create or replace function public.is_public_dive_photo(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.dives d
        where d.id = (split_part(object_name, '/', 2))::uuid
          and d.is_public
          and d.deleted_at is null
    );
$$;

comment on function public.is_public_dive_photo(text) is
    'dive-photos の Storage パスから dive_id を取り出し、その dive が公開中かつ未削除かを返す（Storage RLS 用）';
