-- ========================================
-- dive_photos の書き込みポリシー強化（セキュリティ監査対応）
--
-- 問題1: INSERT の with check が user_id 一致のみで dive の所有権を検証していないため、
--        PostgREST 直叩きで「自分の user_id + 他人の dive_id」の行を挿入でき、
--        他人の公開ログ詳細に任意の画像・キャプションを表示させられる
--        （表示側は dive_id のみで写真を取得するため）。
-- 問題2: UPDATE / DELETE がソフトデリート済み行（deleted_at not null）を制限しないため、
--        管理画面でモデレーション（論理削除）された写真を所有者が編集・物理削除できる。
--
-- 仕様: specs/012-photo-attachments/data-model.md（RLS 表も同期更新済み）
-- ========================================

-- INSERT: 本人の行であること + dive_id が「本人所有かつ未削除の dive」であること
drop policy if exists "users can insert own dive photos" on public.dive_photos;
create policy "users can insert own dive photos"
    on public.dive_photos for insert
    with check (
        (select auth.uid()) = user_id
        and exists (
            select 1
            from public.dives d
            where d.id = dive_id
              and d.user_id = (select auth.uid())
              and d.deleted_at is null
        )
    );

-- UPDATE: 未削除の本人行のみ。dive_id の付け替え先も本人所有 dive に限定
drop policy if exists "users can update own dive photos" on public.dive_photos;
create policy "users can update own dive photos"
    on public.dive_photos for update
    using ((select auth.uid()) = user_id and deleted_at is null)
    with check (
        (select auth.uid()) = user_id
        and deleted_at is null
        and exists (
            select 1
            from public.dives d
            where d.id = dive_id
              and d.user_id = (select auth.uid())
              and d.deleted_at is null
        )
    );

-- DELETE: 未削除の本人行のみ（論理削除済み＝モデレーション対象の証跡は消せない）
drop policy if exists "users can delete own dive photos" on public.dive_photos;
create policy "users can delete own dive photos"
    on public.dive_photos for delete
    using ((select auth.uid()) = user_id and deleted_at is null);
