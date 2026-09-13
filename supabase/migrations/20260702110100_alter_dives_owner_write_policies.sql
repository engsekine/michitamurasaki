-- ========================================
-- dives の所有者書き込みポリシーにソフトデリートガードを追加（セキュリティ監査対応）
--
-- 問題: 20260620100500 は SELECT ポリシーのみ deleted_at is null を追加したため、
--       管理画面で論理削除（モデレーション）されたログを所有者が
--       UPDATE（deleted_at = null の自己復元・内容改変）や物理 DELETE（証跡消去）できる。
--
-- 対応: 所有者の UPDATE / DELETE を「未削除の行」に限定する。
--       復元は管理者ポリシー（admins manage all dives）経由のみ。
-- 仕様: specs/015-admin-panel/data-model.md（削除済み行に対する所有者権限を明文化）
-- ========================================

drop policy if exists "users can update own dives" on public.dives;
create policy "users can update own dives"
    on public.dives for update
    using ((select auth.uid()) = user_id and deleted_at is null)
    with check ((select auth.uid()) = user_id and deleted_at is null);

drop policy if exists "users can delete own dives" on public.dives;
create policy "users can delete own dives"
    on public.dives for delete
    using ((select auth.uid()) = user_id and deleted_at is null);
