-- ========================================
-- user_follows テーブル
-- 承認不要・一方向のフォロー関係（follower が followee をフォロー、spec 021 FR-012）。
-- 自己参照の多対多。PK で重複防止、CHECK で自己フォロー防止。
-- ========================================
create table public.user_follows (
    follower_id uuid not null references public.users(id) on delete cascade,
    followee_id uuid not null references public.users(id) on delete cascade,
    created_at timestamptz not null default now(),

    primary key (follower_id, followee_id),
    constraint user_follows_no_self_check check (follower_id <> followee_id)
);

-- 「自分のフォロー一覧」は PK (follower_id, …) 前方一致が効く。
-- 「自分のフォロワー一覧 / フォロワー数」用に followee_id 単独 index を追加。
create index idx_user_follows_followee_id on public.user_follows (followee_id);

comment on table public.user_follows is '承認不要の一方向フォロー関係。follower が followee をフォロー';

-- ========================================
-- RLS
-- ========================================
alter table public.user_follows enable row level security;

-- SELECT: 認証ユーザーはフォロー関係を閲覧可（件数・一覧表示に必要）
create policy "authenticated can read follows"
    on public.user_follows for select
    to authenticated
    using (true);

-- INSERT: 自分が follower の関係のみ作成可
create policy "users can follow as themselves"
    on public.user_follows for insert
    with check (follower_id = (select auth.uid()));

-- DELETE: 自分が follower の関係のみ解除可
create policy "users can unfollow own follows"
    on public.user_follows for delete
    using (follower_id = (select auth.uid()));
