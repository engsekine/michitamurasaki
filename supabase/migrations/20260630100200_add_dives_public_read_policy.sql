-- ========================================
-- dives 公開読み取りポリシー追加（spec 021 FR-010）
-- 既存の本人 4 ポリシー（select/insert/update/delete）は維持。
-- SELECT は複数ポリシーが OR 結合されるため、
-- 「本人のログ」∪「公開ログ」が認証ユーザーの閲覧可能集合になる。
-- 非公開かつ他人のログは引き続き不可視（spec SC-002）。
-- 論理削除（deleted_at）済みのログは公開扱いでも露出させない。
-- スキーマ（カラム）変更はなし。既存 is_public / public_slug を活性化する。
-- ========================================
create policy "authenticated can read public dives"
    on public.dives for select
    to authenticated
    using (is_public = true and deleted_at is null);

-- タイムライン / 公開ログ一覧（is_public かつ user_id 絞り込み、dive_date 降順）の高速化。
-- キーセットページネーション (dive_date desc, id desc) に整合する部分 index。
create index idx_dives_public_user_date
    on public.dives (user_id, dive_date desc, id desc)
    where is_public = true;
