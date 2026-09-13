-- ========================================
-- お問い合わせ（inquiries）テーブル + 送信関数 + RLS
-- 仕様: specs/020-contact-page/data-model.md
--
-- 公開フォームからの書き込みは security definer 関数 submit_inquiry 経由のみ。
-- テーブルへの直接 INSERT ポリシーは作らず、SELECT / DELETE は管理者（is_admin）に限定する。
-- 強い依存（テーブル + 関数 + RLS）のため 1 ファイルにまとめる（sql.md の例外）。
-- ========================================

create table public.inquiries (
    id uuid primary key default gen_random_uuid(),
    name text not null check (char_length(name) between 1 and 100),
    email text not null check (char_length(email) between 3 and 254),
    category text not null check (category in ('question', 'bug', 'request', 'other')),
    body text not null check (char_length(body) between 1 and 1000),
    submitter_user_id uuid references auth.users(id) on delete set null,
    submitter_ip inet,
    created_at timestamptz not null default now()
);

comment on table public.inquiries is 'お問い合わせフォームから送信された 1 件の問い合わせ。運営者のみ閲覧・削除可能';
comment on column public.inquiries.category is '問い合わせ種別: question/bug/request/other';
comment on column public.inquiries.submitter_user_id is 'ログイン中に送信された場合の送信者。未ログインは null';
comment on column public.inquiries.submitter_ip is 'レート制限・不正調査用の送信元 IP。管理者のみ参照可';

-- 一覧の既定ソート（受付日時降順）
create index idx_inquiries_created_at on public.inquiries (created_at desc);
-- レート制限カウント（同一 IP の直近送信）
create index idx_inquiries_ip_created_at on public.inquiries (submitter_ip, created_at desc);

-- ========================================
-- 送信関数（公開フォームの唯一の書き込み経路）
-- 入力検証 → レート制限 → 重複拒否 → INSERT。
-- security definer + search_path 固定。参照は全てスキーマ修飾する（sql.md）。
-- ========================================
create or replace function public.submit_inquiry(
    p_name text,
    p_email text,
    p_category text,
    p_body text,
    p_submitter_user_id uuid,
    p_submitter_ip inet
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_id uuid;
    v_recent_count integer;
    v_dup_count integer;
begin
    -- 入力検証（アプリ層 yup の最終防御。値・上限はフロントの constants と同値）
    if p_name is null or char_length(p_name) < 1 or char_length(p_name) > 100 then
        raise exception 'invalid_name';
    end if;
    if p_email is null or char_length(p_email) < 3 or char_length(p_email) > 254 then
        raise exception 'invalid_email';
    end if;
    if p_category is null or p_category not in ('question', 'bug', 'request', 'other') then
        raise exception 'invalid_category';
    end if;
    if p_body is null or char_length(p_body) < 1 or char_length(p_body) > 1000 then
        raise exception 'invalid_body';
    end if;

    -- レート制限・重複拒否は IP が分かる場合のみ適用する
    if p_submitter_ip is not null then
        -- 同一 IP から直近 60 秒で 3 件以上は拒否
        select count(*) into v_recent_count
        from public.inquiries
        where submitter_ip = p_submitter_ip
          and created_at > now() - interval '60 seconds';
        if v_recent_count >= 3 then
            raise exception 'rate_limited';
        end if;

        -- 同一 IP + 同一本文が直近 5 分以内なら重複として拒否（多重送信防止）
        select count(*) into v_dup_count
        from public.inquiries
        where submitter_ip = p_submitter_ip
          and body = p_body
          and created_at > now() - interval '5 minutes';
        if v_dup_count > 0 then
            raise exception 'duplicate';
        end if;
    end if;

    insert into public.inquiries (name, email, category, body, submitter_user_id, submitter_ip)
    values (p_name, p_email, p_category, p_body, p_submitter_user_id, p_submitter_ip)
    returning id into v_id;

    return v_id;
end;
$$;

comment on function public.submit_inquiry is 'お問い合わせフォームの送信処理。入力検証・レート制限・重複拒否の上で inquiries に 1 件挿入し id を返す。security definer により RLS をバイパスして書き込む';

-- 既定の PUBLIC への EXECUTE を剥がし、anon / authenticated にのみ付与する
revoke all on function public.submit_inquiry(text, text, text, text, uuid, inet) from public;
grant execute on function public.submit_inquiry(text, text, text, text, uuid, inet) to anon, authenticated;

-- ========================================
-- RLS（管理者のみ閲覧・削除。書き込みは関数経由のみ）
-- is_admin() は security definer + stable（spec 015 で定義済み）。
-- initplan 最適化のため (select ...) で包む（sql.md: auth_rls_initplan）。
-- ========================================
alter table public.inquiries enable row level security;

create policy "admins read inquiries"
    on public.inquiries for select
    to authenticated
    using ((select public.is_admin()));

create policy "admins delete inquiries"
    on public.inquiries for delete
    to authenticated
    using ((select public.is_admin()));
