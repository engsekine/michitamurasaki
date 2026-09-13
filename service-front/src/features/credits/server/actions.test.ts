import { beforeEach, describe, expect, it, vi } from 'vitest';

const sessionsCreate = vi.fn();
const rpc = vi.fn();
const requireUser = vi.fn();

vi.mock('@/features/credits/lib/stripe', () => ({
    getStripe: () => ({ checkout: { sessions: { create: sessionsCreate } } }),
}));
vi.mock('@/shared/lib/supabase/server', () => ({
    createClient: async () => ({ rpc }),
}));
vi.mock('@/shared/lib/auth', () => ({
    requireUser: (...args: unknown[]) => requireUser(...args),
}));

import { createCheckoutSession } from './actions';

describe('createCheckoutSession', () => {
    beforeEach(() => {
        sessionsCreate.mockReset();
        rpc.mockReset();
        requireUser.mockReset();
        requireUser.mockResolvedValue({ user: { id: 'user-1' }, failure: null });
        rpc.mockResolvedValue({ data: 'purchase-1', error: null });
    });

    it('Checkout Session を作成し URL を返す（金額・数量はサーバー定数のみ）', async () => {
        sessionsCreate.mockResolvedValueOnce({ id: 'cs_test_1', url: 'https://checkout.stripe.com/pay/cs_test_1' });

        const result = await createCheckoutSession('trial');

        expect(result).toEqual({ success: true, url: 'https://checkout.stripe.com/pay/cs_test_1' });
        expect(sessionsCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                mode: 'payment',
                client_reference_id: 'user-1',
                metadata: { pack_id: 'trial' },
                line_items: [
                    expect.objectContaining({
                        price_data: expect.objectContaining({ currency: 'jpy', unit_amount: 480 }),
                    }),
                ],
            }),
        );
    });

    it.each([
        { packId: 'trial', unitAmount: 480, quantity: 10 },
        { packId: 'standard', unitAmount: 1200, quantity: 30 },
        { packId: 'bulk', unitAmount: 3000, quantity: 100 },
    ] as const)('パック $packId は ¥$unitAmount / $quantity 枠で Checkout を作成する', async ({
        packId,
        unitAmount,
        quantity,
    }) => {
        sessionsCreate.mockResolvedValueOnce({ id: 'cs_test_1', url: 'https://checkout.stripe.com/pay/cs_test_1' });

        await createCheckoutSession(packId);

        expect(sessionsCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                metadata: { pack_id: packId },
                line_items: [
                    expect.objectContaining({
                        price_data: expect.objectContaining({ unit_amount: unitAmount }),
                    }),
                ],
            }),
        );
        expect(rpc).toHaveBeenCalledWith('create_pending_purchase', {
            p_session_id: 'cs_test_1',
            p_quantity: quantity,
            p_amount_jpy: unitAmount,
        });
    });

    it('未知の packId は失敗を返し Stripe を呼ばない（クライアント入力を信用しない）', async () => {
        const result = await createCheckoutSession('unknown-pack');

        expect(result.success).toBe(false);
        expect(sessionsCreate).not.toHaveBeenCalled();
        expect(rpc).not.toHaveBeenCalled();
    });

    it('pending 購入レコードをセッション ID とパック内容で作成する', async () => {
        sessionsCreate.mockResolvedValueOnce({ id: 'cs_test_1', url: 'https://checkout.stripe.com/pay/cs_test_1' });

        await createCheckoutSession('standard');

        expect(rpc).toHaveBeenCalledWith('create_pending_purchase', {
            p_session_id: 'cs_test_1',
            p_quantity: 30,
            p_amount_jpy: 1200,
        });
    });

    it('Stripe API エラー時は失敗を返し pending を作成しない（US2-AC2）', async () => {
        sessionsCreate.mockRejectedValueOnce(new Error('stripe down'));

        const result = await createCheckoutSession('trial');

        expect(result.success).toBe(false);
        expect(rpc).not.toHaveBeenCalled();
    });

    it('pending 作成に失敗しても URL は返す（webhook の自己修復に委ねる）', async () => {
        sessionsCreate.mockResolvedValueOnce({ id: 'cs_test_1', url: 'https://checkout.stripe.com/pay/cs_test_1' });
        rpc.mockResolvedValueOnce({ data: null, error: { message: 'rls' } });

        const result = await createCheckoutSession('trial');

        expect(result).toEqual({ success: true, url: 'https://checkout.stripe.com/pay/cs_test_1' });
    });

    it('未認証は requireUser の失敗をそのまま返す', async () => {
        requireUser.mockResolvedValueOnce({ user: null, failure: { success: false, error: 'ログインが必要です' } });

        const result = await createCheckoutSession('trial');

        expect(result).toEqual({ success: false, error: 'ログインが必要です' });
        expect(sessionsCreate).not.toHaveBeenCalled();
    });
});
