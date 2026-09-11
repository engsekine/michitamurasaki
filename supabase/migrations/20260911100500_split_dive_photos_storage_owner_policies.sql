-- ========================================
-- dive-photos バケットの所有者ポリシーを操作別に分割（セキュリティ監査対応 2026-09）
--
-- 問題:
--   "owner can manage own dive photo objects"（for all）はパス先頭が自分の user_id であれば
--   全操作を許可していたため、
--   1. 管理画面で論理削除（モデレーション）された写真の実体を所有者が Storage API で削除・上書きでき、
--      テーブル側で塞いだ「証跡は消せない」（20260702110000）の意図が崩れていた
--   2. with check がパス 2 階層目（dive_id）の所有を見ないため、
--      {自uid}/{他人の公開dive_id}/display/x.webp に任意オブジェクトを置けば
--      公開読み取りポリシー経由で全 authenticated から読める置き場になっていた
--
-- 対応: SELECT / INSERT / UPDATE / DELETE に分割し、
--   - INSERT は「自分の uid 配下 かつ 2 階層目が自分の未削除 dive」に限定
--   - UPDATE / DELETE はモデレーション済み（写真行 or 親 dive が論理削除）のオブジェクトを除外
--
-- 仕様: specs/012-photo-attachments/contracts/storage-layout.md（{user_id}/{dive_id}/{kind}/{photo_id}.{ext}）
-- ========================================

-- 対象オブジェクトがモデレーション済みかを返す（Storage RLS 用）
create or replace function public.is_moderated_dive_photo_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.dive_photos p
        where (p.display_path = object_name or p.thumb_path = object_name)
          and p.deleted_at is not null
    )
    or exists (
        select 1
        from public.dives d
        where (storage.foldername(object_name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          and d.id = (storage.foldername(object_name))[2]::uuid
          and d.deleted_at is not null
    );
$$;

comment on function public.is_moderated_dive_photo_object(text) is
    'dive-photos の Storage パスが、論理削除（モデレーション）済みの写真行または dive に属するかを返す（Storage RLS 用）';

revoke execute on function public.is_moderated_dive_photo_object(text) from public, anon;
grant execute on function public.is_moderated_dive_photo_object(text) to authenticated;

drop policy if exists "owner can manage own dive photo objects" on storage.objects;

-- 本人: 自分の user_id 配下（パス先頭）を参照可
create policy "owner can read own dive photo objects"
    on storage.objects for select
    to authenticated
    using (
        bucket_id = 'dive-photos'
        and (select auth.uid())::text = (storage.foldername(name))[1]
    );

-- 本人: 自分の uid 配下 かつ 2 階層目が自分の未削除 dive のときだけアップロード可
create policy "owner can insert own dive photo objects"
    on storage.objects for insert
    to authenticated
    with check (
        bucket_id = 'dive-photos'
        and (select auth.uid())::text = (storage.foldername(name))[1]
        and (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and exists (
            select 1
            from public.dives d
            where d.id = (storage.foldername(name))[2]::uuid
              and d.user_id = (select auth.uid())
              and d.deleted_at is null
        )
    );

-- 本人: モデレーション済みでないオブジェクトのみ上書き可
create policy "owner can update own dive photo objects"
    on storage.objects for update
    to authenticated
    using (
        bucket_id = 'dive-photos'
        and (select auth.uid())::text = (storage.foldername(name))[1]
        and not public.is_moderated_dive_photo_object(name)
    )
    with check (
        bucket_id = 'dive-photos'
        and (select auth.uid())::text = (storage.foldername(name))[1]
    );

-- 本人: モデレーション済みでないオブジェクトのみ削除可
create policy "owner can delete own dive photo objects"
    on storage.objects for delete
    to authenticated
    using (
        bucket_id = 'dive-photos'
        and (select auth.uid())::text = (storage.foldername(name))[1]
        and not public.is_moderated_dive_photo_object(name)
    );
