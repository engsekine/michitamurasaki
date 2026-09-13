import 'server-only';

import type { Database } from '@repo/supabase';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

import { findLogCreditPack } from '@/features/credits/constants';

/** webhook / 付与処理で使う service_role クライアントの型 */
export type ServiceRoleClient = SupabaseClient<Database>;

/**
 * Stripe SDK の初期化（遅延生成）。
 * STRIPE_SECRET_KEY はサーバー環境変数のみ。クライアントバンドルへは含めない
 */
export const getStripe = (): Stripe => {
    const secretKey = process.env['STRIPE_SECRET_KEY'];
    if (!secretKey) throw new Error('STRIPE_SECRET_KEY が設定されていません');
    return new Stripe(secretKey);
};

/**
 * service_role の Supabase クライアント（webhook 専用）。
 * ユーザーセッションが存在しないサーバー間通信で RLS をバイパスして書き込む。
 * この関数を route handler / server 専用モジュール以外から import しないこと
 */
export const createServiceRoleClient = (): ServiceRoleClient => {
    const url = process.env['SUPABASE_INTERNAL_URL'] ?? process.env['NEXT_PUBLIC_SUPABASE_URL'];
    const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
    if (!url || !serviceRoleKey) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY / SUPABASE_URL が設定されていません');
    }
    return createSupabaseClient<Database>(url, serviceRoleKey, { auth: { persistSession: false } });
};

interface FulfillResult {
    credited: boolean;
    reason?: 'unpaid' | 'missing_user' | 'already_credited' | 'unknown_pack' | 'amount_mismatch';
}

/** 決済通貨（Checkout Session 作成時と一致させる） */
const CHECKOUT_CURRENCY = 'jpy';

/**
 * checkout.session.completed / async_payment_succeeded の枠付与（026 / FR-005・007）。
 * 冪等性は DB 側（session_id ユニーク + credited_at 条件付き更新）が担保するため、
 * 重複 webhook でも安全に何度でも呼べる。DB エラーは throw し、
 * route が 500 を返して Stripe の自動リトライに委ねる。
 *
 * 付与量は Stripe が検証した Session（metadata.pack_id と実請求額）から決める。
 * pending 行は authenticated が RPC 直叩きで任意の数量を植えられるため、
 * DB 行のスナップショットを真実にせず、Stripe の値と一致しないものは付与しない。
 */
export const fulfillCheckoutSession = async (
    supabase: ServiceRoleClient,
    session: Stripe.Checkout.Session,
): Promise<FulfillResult> => {
    if (session.payment_status !== 'paid') return { credited: false, reason: 'unpaid' };

    const userId = session.client_reference_id;
    if (!userId) return { credited: false, reason: 'missing_user' };

    const pack = findLogCreditPack(session.metadata?.['pack_id'] ?? '');
    if (!pack) {
        console.error(`[fulfillCheckoutSession] 不明な pack_id: session=${session.id}`);
        return { credited: false, reason: 'unknown_pack' };
    }

    // 実際に請求された金額・通貨・モードがパック定義と一致することを確認する（改ざん・別経路の Checkout を排除）
    if (
        session.mode !== 'payment' ||
        session.currency !== CHECKOUT_CURRENCY ||
        session.amount_total !== pack.amountJpy
    ) {
        console.error(
            `[fulfillCheckoutSession] 金額不一致: session=${session.id} pack=${pack.id} expected=${pack.amountJpy} actual=${session.amount_total} currency=${session.currency} mode=${session.mode}`,
        );
        return { credited: false, reason: 'amount_mismatch' };
    }

    const paymentIntentId =
        typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent?.id ?? '');

    const { data: credited, error } = await supabase.rpc('complete_purchase', {
        p_session_id: session.id,
        p_payment_intent_id: paymentIntentId,
        p_user_id: userId,
        p_quantity: pack.quantity,
        p_amount_jpy: pack.amountJpy,
    });
    if (error) throw new Error(`complete_purchase に失敗: ${error.message}`);

    return credited === true ? { credited: true } : { credited: false, reason: 'already_credited' };
};

/**
 * charge.refunded の残枠調整（spec Edge Case: 未消費分を上限に差し引き 0 で床打ち）。
 * 冪等キーは refund ID（未展開の場合は charge ID で代替）
 */
export const processRefund = async (
    supabase: ServiceRoleClient,
    charge: Stripe.Charge,
): Promise<{ adjusted: boolean }> => {
    const paymentIntentId =
        typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
    if (!paymentIntentId) return { adjusted: false };

    const refundId = charge.refunds?.data?.[0]?.id ?? charge.id;

    const { data: adjusted, error } = await supabase.rpc('apply_refund', {
        p_payment_intent_id: paymentIntentId,
        p_refund_id: refundId,
    });
    if (error) throw new Error(`apply_refund に失敗: ${error.message}`);

    return { adjusted: adjusted === true };
};

/**
 * 決済不成立（session expired / async payment failed）の購入レコードを failed にする。
 * 枠は付与しない（US2-AC2）。付与済みレコードは対象外（credited_at is null のみ）
 */
export const markPurchaseFailed = async (supabase: ServiceRoleClient, sessionId: string): Promise<void> => {
    const { error } = await supabase
        .from('log_credit_purchases')
        .update({ status: 'failed' })
        .eq('stripe_checkout_session_id', sessionId)
        .is('credited_at', null);
    if (error) throw new Error(`購入の failed 更新に失敗: ${error.message}`);
};
