'use server';

import { findLogCreditPack } from '@/features/credits/constants';
import { getStripe } from '@/features/credits/lib/stripe';
import { requireUser } from '@/shared/lib/auth';
import { createClient } from '@/shared/lib/supabase/server';
import { type ActionResult, actionFailure, actionSuccess } from '@/shared/types/action-result';

const getSiteUrl = (): string => process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://localhost:3000';

const CHECKOUT_FAILED_MESSAGE = '購入手続きの開始に失敗しました。時間をおいて再度お試しください';
const UNKNOWN_PACK_MESSAGE = '選択されたログパックが見つかりません。ページを再読み込みしてお試しください';

/**
 * ログパック購入の Checkout Session を作成する（026 / FR-005）。
 * クライアントからは packId のみ受け取り、金額・数量は LOG_CREDIT_PACKS（サーバー定数）で解決する。
 * 枠の付与はここでは行わない — webhook（checkout.session.completed）が唯一の付与トリガー（FR-007）
 */
export const createCheckoutSession = async (packId: string): Promise<ActionResult<{ url: string }>> => {
    const pack = findLogCreditPack(packId);
    if (!pack) return actionFailure(UNKNOWN_PACK_MESSAGE);

    const supabase = await createClient();

    const { user, failure } = await requireUser(supabase);
    if (failure) return failure;

    let checkoutUrl: string;
    let sessionId: string;
    try {
        const stripe = getStripe();
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            client_reference_id: user.id,
            // webhook（fulfillCheckoutSession）が付与するパックを判別するための識別子
            metadata: { pack_id: pack.id },
            line_items: [
                {
                    quantity: 1,
                    price_data: {
                        currency: 'jpy',
                        unit_amount: pack.amountJpy,
                        product_data: { name: pack.displayName },
                    },
                },
            ],
            success_url: `${getSiteUrl()}/settings/log-credits?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${getSiteUrl()}/settings/log-credits?checkout=cancelled`,
        });
        if (!session.url) return actionFailure(CHECKOUT_FAILED_MESSAGE);
        checkoutUrl = session.url;
        sessionId = session.id;
    } catch (error) {
        console.error('[createCheckoutSession] stripe error:', error);
        return actionFailure(CHECKOUT_FAILED_MESSAGE);
    }

    // pending の購入レコードを作成する（履歴と webhook 突合の起点）。
    // 失敗しても webhook 側の自己修復（complete_purchase の補完作成）で付与は成立するため、
    // ログのみ残して購入フローは継続する
    const { error: pendingError } = await supabase.rpc('create_pending_purchase', {
        p_session_id: sessionId,
        p_quantity: pack.quantity,
        p_amount_jpy: pack.amountJpy,
    });
    if (pendingError) {
        console.error('[createCheckoutSession] create_pending_purchase error:', pendingError);
    }

    return actionSuccess({ url: checkoutUrl });
};
