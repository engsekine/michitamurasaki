-- ========================================
-- 026-log-monetization: ログパック購入の確定・返金関数（US2）
--
-- 枠付与は Stripe webhook（checkout.session.completed）受領後のみ。
-- 冪等性は DB の一意制約 + 条件付き更新で担保する（contracts/stripe-webhook.md）:
-- - 購入: stripe_checkout_session_id ユニーク + credited_at is null の条件付き更新
-- - 返金: log_credit_ledger.stripe_refund_id ユニーク
-- ========================================

-- ========================================
-- create_pending_purchase（RPC・authenticated 実行可）
-- Checkout Session 作成直後に pending の購入レコードを本人分だけ作る。
-- 金額・数量はサーバー定数由来（Server Action からのみ渡る）
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
begin
    if v_user_id is null then
        raise exception 'authentication required' using errcode = '28000';
    end if;

    insert into public.log_credit_purchases (user_id, quantity, amount_jpy, stripe_checkout_session_id)
    values (v_user_id, p_quantity, p_amount_jpy, p_session_id)
    on conflict (stripe_checkout_session_id) do nothing
    returning id into v_purchase_id;

    return v_purchase_id;
end;
$$;

-- ========================================
-- complete_purchase（webhook 専用・service_role のみ）
-- 決済完了を確定し枠を付与する。戻り値 = 付与したか（false は付与済み no-op）。
-- pending レコードが無い場合は自己修復として作成する（Server Action 側の作成失敗対策）
-- ========================================
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
    -- 自己修復: pending が無ければ webhook の情報から補完作成する
    insert into public.log_credit_purchases (user_id, quantity, amount_jpy, stripe_checkout_session_id)
    values (p_user_id, p_quantity, p_amount_jpy, p_session_id)
    on conflict (stripe_checkout_session_id) do nothing;

    -- 未付与のときだけ確定する（条件付き更新が冪等キー。重複 webhook は 0 行更新）
    update public.log_credit_purchases
    set status = 'completed',
        credited_at = now(),
        stripe_payment_intent_id = p_payment_intent_id
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

-- ========================================
-- apply_refund（webhook 専用・service_role のみ）
-- 返金された購入の付与枠を、未消費分（= 現在残高）を上限に差し引く。
-- 残高が足りない場合は 0 で床打ちする（spec Edge Case）。
-- 戻り値 = 調整を行ったか（false は対象外決済 / 処理済み no-op）
-- ========================================
create or replace function public.apply_refund(
    p_payment_intent_id text,
    p_refund_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_purchase public.log_credit_purchases%rowtype;
    v_balance integer;
    v_adjustment integer;
begin
    select * into v_purchase
    from public.log_credit_purchases
    where stripe_payment_intent_id = p_payment_intent_id
      and status = 'completed';
    if v_purchase.id is null then
        return false;
    end if;

    -- 残高をロックして未消費分を確定する（消費との競合を直列化）
    select balance into v_balance
    from public.log_credit_balances
    where user_id = v_purchase.user_id
    for update;

    v_adjustment := least(v_purchase.quantity, coalesce(v_balance, 0));

    begin
        if v_adjustment > 0 then
            perform public.apply_credit_ledger_entry(
                v_purchase.user_id,
                'refund_adjustment',
                -v_adjustment,
                null,
                null,
                v_purchase.id,
                p_refund_id
            );
        end if;
    exception
        when unique_violation then
            -- 同じ refund_id は処理済み（重複 webhook）
            return false;
    end;

    update public.log_credit_purchases
    set status = 'refunded'
    where id = v_purchase.id;
    return true;
end;
$$;

-- ========================================
-- 実行権限（data-model.md の権限表）
-- ========================================
revoke execute on function public.create_pending_purchase(text, integer, integer) from public, anon;
grant execute on function public.create_pending_purchase(text, integer, integer) to authenticated, service_role;

revoke execute on function public.complete_purchase(text, text, uuid, integer, integer)
    from public, anon, authenticated;
grant execute on function public.complete_purchase(text, text, uuid, integer, integer) to service_role;

revoke execute on function public.apply_refund(text, text) from public, anon, authenticated;
grant execute on function public.apply_refund(text, text) to service_role;
