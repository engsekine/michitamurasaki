import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClient = vi.fn();

vi.mock('@/shared/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => createClient(...args),
}));

import { getCreditBalance, getPurchaseHistory } from './queries';

const buildBalanceClient = (options: {
    user?: { id: string } | null;
    balanceRow?: { balance: number } | null;
    error?: { message: string } | null;
}) => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: options.user ?? { id: 'user-1' } } }) },
    from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
                maybeSingle: vi
                    .fn()
                    .mockResolvedValue({ data: options.balanceRow ?? null, error: options.error ?? null }),
            }),
        }),
    }),
});

const buildHistoryClient = (options: { rows?: unknown[]; error?: { message: string } | null }) => ({
    auth: { getUser: vi.fn() },
    from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: options.rows ?? [], error: options.error ?? null }),
            }),
        }),
    }),
});

describe('getCreditBalance', () => {
    beforeEach(() => {
        createClient.mockReset();
    });

    it('残高行があればその値を返す', async () => {
        createClient.mockResolvedValue(buildBalanceClient({ balanceRow: { balance: 12 } }));
        expect(await getCreditBalance()).toBe(12);
    });

    it('残高行が無ければ 0 を返す（防御的デフォルト）', async () => {
        createClient.mockResolvedValue(buildBalanceClient({ balanceRow: null }));
        expect(await getCreditBalance()).toBe(0);
    });

    it('未認証なら 0 を返す', async () => {
        createClient.mockResolvedValue(buildBalanceClient({ user: null }));
        expect(await getCreditBalance()).toBe(0);
    });

    it('取得エラー時は 0 を返す（表示側を落とさない）', async () => {
        createClient.mockResolvedValue(buildBalanceClient({ error: { message: 'down' } }));
        expect(await getCreditBalance()).toBe(0);
    });
});

describe('getPurchaseHistory', () => {
    beforeEach(() => {
        createClient.mockReset();
    });

    it('行を camelCase の Purchase に変換して返す（FR-014）', async () => {
        createClient.mockResolvedValue(
            buildHistoryClient({
                rows: [
                    {
                        id: 'p-1',
                        quantity: 10,
                        amount_jpy: 300,
                        status: 'completed',
                        created_at: '2026-07-01T00:00:00+00:00',
                    },
                ],
            }),
        );

        expect(await getPurchaseHistory()).toEqual([
            { id: 'p-1', quantity: 10, amountJpy: 300, status: 'completed', purchasedAt: '2026-07-01T00:00:00+00:00' },
        ]);
    });

    it('取得エラー時は空配列を返す', async () => {
        createClient.mockResolvedValue(buildHistoryClient({ error: { message: 'down' } }));
        expect(await getPurchaseHistory()).toEqual([]);
    });
});
