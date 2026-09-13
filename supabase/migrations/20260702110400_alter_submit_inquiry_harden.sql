-- ========================================
-- submit_inquiry の強化（セキュリティ監査対応）
--
-- 問題: anon / authenticated に grant された security definer 関数の引数
--       p_submitter_user_id / p_submitter_ip を呼び出し元が任意指定できるため、
--       1. 他人の UUID を渡して「その利用者からの問い合わせ」に偽装できる
--       2. p_submitter_ip = null（または毎回異なる値）を渡すと
--          レート制限・重複拒否を完全にバイパスでき、
--          自動返信メールを踏み台にした第三者宛スパム（メール増幅）が成立する
--
-- 対応:
--   - submitter_user_id は引数を無視し、関数内で auth.uid() を採用（偽装防止）
--   - IP に依存しないガードを追加:
--     同一メール宛のレート制限・重複拒否（メール増幅の抑止）+ 全体流量の安全弁
--   - 引数シグネチャは互換性のため維持する（アプリ側の呼び出しは変更不要）
--
-- 仕様: specs/020-contact-page/（XFF 偽装の残存リスクと本ガードを明記）
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
    -- 偽装防止: 引数ではなくセッションの auth.uid() を採用（anon は null）
    v_submitter_user_id uuid := (select auth.uid());
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

    -- IP 非依存ガード1: 同一メール宛は直近 60 秒で 3 件以上を拒否
    -- （XFF 偽装・IP null でも自動返信メールの増幅を抑止する）
    select count(*) into v_recent_count
    from public.inquiries
    where email = p_email
      and created_at > now() - interval '60 seconds';
    if v_recent_count >= 3 then
        raise exception 'rate_limited';
    end if;

    -- IP 非依存ガード2: 同一メール + 同一本文が直近 5 分以内なら重複として拒否
    select count(*) into v_dup_count
    from public.inquiries
    where email = p_email
      and body = p_body
      and created_at > now() - interval '5 minutes';
    if v_dup_count > 0 then
        raise exception 'duplicate';
    end if;

    -- IP 非依存ガード3（安全弁）: サイト全体で直近 60 秒に 20 件以上は拒否
    -- （メール・IP を毎回変えるスパムによるストレージ/メール枯渇を止める。
    --   正常運用でこの流量に達することは想定しない）
    select count(*) into v_recent_count
    from public.inquiries
    where created_at > now() - interval '60 seconds';
    if v_recent_count >= 20 then
        raise exception 'rate_limited';
    end if;

    -- IP が分かる場合の追加ガード（従来どおり）
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
    values (p_name, p_email, p_category, p_body, v_submitter_user_id, p_submitter_ip)
    returning id into v_id;

    return v_id;
end;
$$;

comment on function public.submit_inquiry is
    'お問い合わせフォームの送信処理。入力検証・レート制限（メール宛/全体/IP）・重複拒否の上で inquiries に 1 件挿入し id を返す。submitter_user_id は引数を無視し auth.uid() を記録する（偽装防止）';
