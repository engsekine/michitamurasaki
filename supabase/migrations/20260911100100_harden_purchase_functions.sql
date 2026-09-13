-- ========================================
-- ログパック購入関数の強化（セキュリティ監査対応 2026-09）
--
-- 問題:
--   1. create_pending_purchase は authenticated が PostgREST から直接呼べ、
--      p_quantity / p_amount_jpy を検証せずに保存していた（任意の数量の pending 行を植えられる）
--   2. complete_purchase は既存 pending 行のスナップショット（quantity）を付与量に採用していたため、
--      Server Action の pending 作成が一時的に失敗したセッション等で、植えられた巨大 quantity が
--      そのまま付与され得た（決済フローで Stripe ではなく DB が真実になっていた）
--
-- 対応:
--   - create_pending_purchase: Session ID の形式・数量/金額の範囲・本人の pending 件数を検証する
--   - complete_purchase: webhook（Stripe が署名検証したイベント）由来の user_id / quantity / amount_jpy で
--     行を上書きしてから付与する。pending 行の値は付与量に使わない
--   - 引数シグネチャは互換性のため維持する（アプリ側の呼び出しは変更不要）
--
-- 仕様: specs/026-log-monetization/contracts/stripe-webhook.md
-- ========================================

create or replace function public.create_pending_purchase(
    p_session_id text,
    p_quantity integer,
    p_amount_jpy integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := (select auth.uid());
    v_purchase_id uuid;
    v_recent_pending integer;
begin
    if v_user_id is null then
        raise exception 'authentication required' using errcode = '28000';
    end if;

    -- Stripe Checkout Session ID の形式（cs_test_... / cs_live_...）以外は受け付けない
    if p_session_id is null or p_session_id !~ '^cs_(test|live)_[A-Za-z0-9]{10,200}$' then
        raise exception 'invalid_session_id';
    end if;
    -- 数量・金額はサーバー定数（LOG_CREDIT_PACKS）由来のみを想定した現実的な範囲に限定する
    if p_quantity is null or p_quantity not between 1 and 1000 then
        raise exception 'invalid_quantity';
    end if;
    if p_amount_jpy is null or p_amount_jpy not between 0 and 1000000 then
        raise exception 'invalid_amount';
    end if;

    -- 直近 1 時間の本人 pending 件数上限（ゴミ行の蓄積・ユニークインデックス肥大を防ぐ安全弁）
    select count(*) into v_recent_pending
    from public.log_credit_purchases
    where user_id = v_user_id
      and status = 'pending'
      and created_at > now() - interval '1 hour';
    if v_recent_pending >= 20 then
        raise exception 'rate_limited';
    end if;

    insert into public.log_credit_purchases (user_id, quantity, amount_jpy, stripe_checkout_session_id)
    values (v_user_id, p_quantity, p_amount_jpy, p_session_id)
    on conflict (stripe_checkout_session_id) do nothing
    returning id into v_purchase_id;

    return v_purchase_id;
end;
$$;

comment on function public.create_pending_purchase(text, integer, integer) is
    'Checkout Session 作成直後に pending の購入レコードを本人分だけ作る。Session ID 形式・数量/金額範囲・本人の pending 件数を検証する。付与量は complete_purchase が Stripe 由来の値で確定する';

create or replace function public.complete_purchase(
    p_session_id text,
    p_payment_intent_id text,
    p_user_id uuid,
    p_quantity integer,
    p_amount_jpy integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_purchase public.log_credit_purchases%rowtype;
begin
    if p_quantity is null or p_quantity < 1 then
        raise exception 'invalid_quantity';
    end if;
    if p_amount_jpy is null or p_amount_jpy < 0 then
        raise exception 'invalid_amount';
    end if;

    -- 自己修復: pending が無ければ webhook の情報から補完作成する
    insert into public.log_credit_purchases (user_id, quantity, amount_jpy, stripe_checkout_session_id)
    values (p_user_id, p_quantity, p_amount_jpy, p_session_id)
    on conflict (stripe_checkout_session_id) do nothing;

    -- 未付与のときだけ確定する（条件付き更新が冪等キー。重複 webhook は 0 行更新）。
    -- user_id / quantity / amount_jpy は Stripe（webhook）の値で上書きする:
    -- pending 行は authenticated が RPC 直叩きで任意の値を植えられるため、行のスナップショットを真実にしない
    update public.log_credit_purchases
    set status = 'completed',
        credited_at = now(),
        stripe_payment_intent_id = p_payment_intent_id,
        user_id = p_user_id,
        quantity = p_quantity,
        amount_jpy = p_amount_jpy
    where stripe_checkout_session_id = p_session_id
      and credited_at is null
    returning * into v_purchase;

    if v_purchase.id is null then
        return false;
    end if;

    perform public.apply_credit_ledger_entry(
        v_purchase.user_id,
        'purchase',
        v_purchase.quantity,
        null,
        null,
        v_purchase.id
    );
    return true;
end;
$$;

comment on function public.complete_purchase(text, text, uuid, integer, integer) is
    '決済完了（webhook）を確定し枠を付与する。付与量・購入者は Stripe 由来の引数で確定し、pending 行の値は信用しない。戻り値 = 付与したか（false は付与済み no-op）';
