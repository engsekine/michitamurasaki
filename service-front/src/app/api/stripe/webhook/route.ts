import type Stripe from 'stripe';

import {
    createServiceRoleClient,
    fulfillCheckoutSession,
    getStripe,
    markPurchaseFailed,
    processRefund,
} from '@/features/credits/lib/stripe';

/**
 * Stripe webhook（026 / contracts/stripe-webhook.md）。
 * ログ枠付与の唯一のトリガー。応答規約:
 * - 200: 処理成功・冪等 no-op・未対応イベント
 * - 400: 署名検証失敗（Stripe はリトライしない）
 * - 500: 一時的失敗（Stripe の自動リトライに委ねる）
 */
export async function POST(request: Request): Promise<Response> {
    const signature = request.headers.get('stripe-signature');
    if (!signature) return new Response('missing signature', { status: 400 });

    const webhookSecret = process.env['STRIPE_WEBHOOK_SECRET'];
    if (!webhookSecret) {
        console.error('[stripe webhook] STRIPE_WEBHOOK_SECRET が設定されていません');
        return new Response('server misconfigured', { status: 500 });
    }

    // 署名検証は生ボディに対して行う（JSON parse 後では検証できない）
    const rawBody = await request.text();
    let event: Stripe.Event;
    try {
        event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (error) {
        console.error('[stripe webhook] 署名検証に失敗:', error);
        return new Response('invalid signature', { status: 400 });
    }

    const supabase = createServiceRoleClient();

    try {
        switch (event.type) {
            // 遅延決済（コンビニ払い・銀行振込等）は completed 時点では unpaid で届き、
            // 入金後に async_payment_succeeded が来る。片方だけ処理すると「支払済みだが未付与」が固定化する
            case 'checkout.session.completed':
            case 'checkout.session.async_payment_succeeded': {
                const result = await fulfillCheckoutSession(supabase, event.data.object);
                if (!result.credited) console.warn(`[stripe webhook] 付与なし: ${result.reason}`);
                break;
            }
            case 'checkout.session.expired':
            case 'checkout.session.async_payment_failed': {
                await markPurchaseFailed(supabase, event.data.object.id);
                break;
            }
            case 'charge.refunded': {
                await processRefund(supabase, event.data.object);
                break;
            }
            default:
                // 未対応イベントは無視して 200（Stripe に再送させない）
                break;
        }
    } catch (error) {
        // 一時的失敗（DB 接続断等）。500 で Stripe の自動リトライに委ねる。
        // 付与の冪等性は DB 制約が担保するためリトライは安全
        console.error(`[stripe webhook] ${event.type} の処理に失敗:`, error);
        return new Response('processing failed', { status: 500 });
    }

    return Response.json({ received: true });
}
