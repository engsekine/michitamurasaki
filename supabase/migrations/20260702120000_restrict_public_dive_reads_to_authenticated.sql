-- ========================================
-- 公開ダイブ関連の読み取りを authenticated に限定する（セキュリティ監査対応）
--
-- 背景: 匿名共有ページは 021/20260701130000 で廃止され、アプリに anon の閲覧導線は
--       存在しない。しかし以下の読み取り面が anon に開いたまま残置されており、
--       anon キー直叩き + ID 判明時に公開ログの写真・バディ名を匿名取得できた。
--   1. dive_photos の "anyone can read public dive photos"（to 句なし = anon 含む）
--   2. Storage の "public can read display of public dives"（to anon, authenticated）
--   3. dive_log_buddies の "read buddies of viewable dives"（to 句なし）
--
-- 対応: いずれも to authenticated に絞る。プロダクト方針
--       「未ログイン（匿名）からは閲覧できない」（021 spec）に一致させる。
-- ========================================

-- 1. dive_photos の公開読み取り（定義は 20260620100500 のものを維持し to のみ追加）
drop policy if exists "anyone can read public dive photos" on public.dive_photos;
create policy "anyone can read public dive photos"
    on public.dive_photos for select
    to authenticated
    using (
        deleted_at is null
        and exists (
            select 1
            from public.dives d
            where d.id = dive_id
              and d.is_public
              and d.deleted_at is null
        )
    );

-- 2. Storage の公開読み取り（定義は 20260616110100 のものを維持し anon を除去）
drop policy if exists "public can read display of public dives" on storage.objects;
create policy "public can read display of public dives"
    on storage.objects for select
    to authenticated
    using (
        bucket_id = 'dive-photos'
        and (storage.foldername(name))[3] in ('display', 'thumb')
        and public.is_public_dive_photo(name)
    );

-- 3. バディの読み取り（定義は 20260630100000 のものを維持し to のみ追加）
drop policy if exists "read buddies of viewable dives" on public.dive_log_buddies;
create policy "read buddies of viewable dives"
    on public.dive_log_buddies for select
    to authenticated
    using (
        exists (
            select 1 from public.dives d
            where d.id = dive_id
              and (d.user_id = (select auth.uid()) or (d.is_public = true and d.deleted_at is null))
        )
        or buddy_user_id = (select auth.uid())
    );
