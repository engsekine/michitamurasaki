-- ========================================
-- お問い合わせ送信のレート制限強化（セキュリティ監査対応 2026-09）
--
-- 問題:
--   - submit_inquiry は anon から呼べ、Server Action 経由なら送信者アドレス宛に自動返信メールを送る。
--     既存ガードは「同一メール宛 3 件/60 秒」のみで、本文を変えれば第三者アドレスへ
--     3 通/分（= 4,000 通/日超）のメール爆撃を無期限に続けられた。
--   - p_submitter_ip は呼び出し元が任意指定できる（XFF 先頭値）ため IP 制限は回避可能。
--   - discard_recent_inquiry(uuid) は ID を知っていれば誰の行でも削除でき、
--     RPC 直叩きで submit → 即 discard を繰り返すとレート制限カウントをリセットできた。
--
-- 対応:
--   - 同一メール宛: 1 時間 3 件 / 24 時間 5 件、同一 IP: 1 時間 10 件、
--     ログイン中は auth.uid() 単位で 24 時間 5 件 の上限を追加する（既存ガードは維持）
--   - discard_recent_inquiry は送信者メールを引数に取り、同一メール（かつログイン中は本人）の行のみ削除できるようにする
--
-- 仕様: specs/020-contact-page/
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
    select count(*) into v_recent_count
    from public.inquiries
    where lower(email) = lower(p_email)
      and created_at > now() - interval '60 seconds';
    if v_recent_count >= 3 then
        raise exception 'rate_limited';
    end if;

    -- IP 非依存ガード1': 同一メール宛は 1 時間 3 件 / 24 時間 5 件まで（自動返信メールの増幅を日次で抑止）
    select count(*) into v_recent_count
    from public.inquiries
    where lower(email) = lower(p_email)
      and created_at > now() - interval '1 hour';
    if v_recent_count >= 3 then
        raise exception 'rate_limited';
    end if;
    select count(*) into v_recent_count
    from public.inquiries
    where lower(email) = lower(p_email)
      and created_at > now() - interval '24 hours';
    if v_recent_count >= 5 then
        raise exception 'rate_limited';
    end if;

    -- IP 非依存ガード2: 同一メール + 同一本文が直近 5 分以内なら重複として拒否
    select count(*) into v_dup_count
    from public.inquiries
    where lower(email) = lower(p_email)
      and body = p_body
      and created_at > now() - interval '5 minutes';
    if v_dup_count > 0 then
        raise exception 'duplicate';
    end if;

    -- IP 非依存ガード3（安全弁）: サイト全体で直近 60 秒に 20 件以上は拒否
    select count(*) into v_recent_count
    from public.inquiries
    where created_at > now() - interval '60 seconds';
    if v_recent_count >= 20 then
        raise exception 'rate_limited';
    end if;

    -- ログイン中はアカウント単位でも制限する（IP・メールを変えても止まる）
    if v_submitter_user_id is not null then
        select count(*) into v_recent_count
        from public.inquiries
        where submitter_user_id = v_submitter_user_id
          and created_at > now() - interval '24 hours';
        if v_recent_count >= 5 then
            raise exception 'rate_limited';
        end if;
    end if;

    -- IP が分かる場合の追加ガード（呼び出し元指定のため補助的）
    if p_submitter_ip is not null then
        select count(*) into v_recent_count
        from public.inquiries
        where submitter_ip = p_submitter_ip
          and created_at > now() - interval '60 seconds';
        if v_recent_count >= 3 then
            raise exception 'rate_limited';
        end if;

        select count(*) into v_recent_count
        from public.inquiries
        where submitter_ip = p_submitter_ip
          and created_at > now() - interval '1 hour';
        if v_recent_count >= 10 then
            raise exception 'rate_limited';
        end if;

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
    'お問い合わせフォームの送信処理。入力検証・レート制限（メール宛 分/時/日・アカウント・全体・IP）・重複拒否の上で inquiries に 1 件挿入し id を返す。submitter_user_id は引数を無視し auth.uid() を記録する（偽装防止）';

-- discard_recent_inquiry: 送信者メールと紐づけて削除範囲を限定する
drop function if exists public.discard_recent_inquiry(uuid);

create function public.discard_recent_inquiry(p_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    delete from public.inquiries
    where id = p_id
      and lower(email) = lower(p_email)
      and created_at > now() - interval '2 minutes'
      and (submitter_user_id is null or submitter_user_id = (select auth.uid()));
end;
$$;

comment on function public.discard_recent_inquiry(uuid, text) is
    '通知メール送信に失敗した直後のお問い合わせ行を取り消す（厳密通知の再送時に重複ガードへ当たるのを防ぐ）。直近 2 分以内・同一メール・（ログイン中は）本人の行のみ削除する';

revoke all on function public.discard_recent_inquiry(uuid, text) from public, anon, authenticated;
grant execute on function public.discard_recent_inquiry(uuid, text) to anon, authenticated;
