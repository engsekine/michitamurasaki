-- ========================================
-- dive_likes テーブル（027 / US1-US2）
--
-- 公開ダイブログへのいいね。「どの利用者が・どのログに・いつ」を表し、
-- 利用者 × ログの組で一意（FR-003）。取り消しは物理削除（履歴を持たない）。
-- 通知の生成トリガーは後続マイグレーションで追加する。
-- 仕様: specs/027-log-likes/data-model.md
-- ========================================

create table public.dive_likes (
    user_id uuid not null references public.users(id) on delete cascade,
    dive_id uuid not null references public.dives(id) on delete cascade,
    created_at timestamptz not null default now(),

    primary key (user_id, dive_id)
);

comment on table public.dive_likes is '公開ダイブログへのいいね。利用者×ログで一意、取り消しは物理削除（履歴なし）';
comment on column public.dive_likes.created_at is 'いいねした日時。いいね一覧はこの降順で表示する';

-- FK インデックス（必須）+ ログ単位の件数集計（FR-004）
create index idx_dive_likes_dive_id on public.dive_likes(dive_id);

-- いいね一覧の keyset ページング（FR-007 / SC-005）。
-- PK (user_id, dive_id) では created_at の並び順を賄えないため別途作成
create index idx_dive_likes_user_id_created_at on public.dive_likes(user_id, created_at desc, dive_id desc);

alter table public.dive_likes enable row level security;

-- 読み取り: 自分のいいね全件 + 閲覧可能なログ（公開中 or 本人所有）のいいね（件数集計用）
create policy "users can read likes of viewable dives"
    on public.dive_likes for select
    to authenticated
    using (
        user_id = (select auth.uid())
        or exists (
            select 1 from public.dives d
            where d.id = dive_id
              and (d.user_id = (select auth.uid()) or (d.is_public and d.deleted_at is null))
        )
    );

-- 作成: 本人の行 × 公開中の他人のログのみ（自己いいね・非公開ログ・削除済みログを DB 層で拒否 / FR-006・FR-014）
create policy "users can like public dives of others"
    on public.dive_likes for insert
    to authenticated
    with check (
        user_id = (select auth.uid())
        and exists (
            select 1 from public.dives d
            where d.id = dive_id
              and d.is_public
              and d.deleted_at is null
              and d.user_id <> (select auth.uid())
        )
    );

-- 削除（取り消し）: 本人のいいねのみ（FR-002）。UPDATE ポリシーは定義しない（更新操作が存在しない）
create policy "users can delete own likes"
    on public.dive_likes for delete
    to authenticated
    using (user_id = (select auth.uid()));
