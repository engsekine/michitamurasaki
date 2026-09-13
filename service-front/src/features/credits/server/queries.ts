import 'server-only';

import type { Purchase, PurchaseStatus } from '@/features/credits/types';
import { createClient } from '@/shared/lib/supabase/server';

/**
 * 自分のログ枠残高を取得する（026 / FR-013）。
 * 残高行が未作成（理論上は初期付与で必ず存在するが防御的に）や
 * 未認証の場合は 0 を返し、表示側で「作成不可」として扱えるようにする。
 */
export const getCreditBalance = async (): Promise<number> => {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return 0;

    const { data, error } = await supabase
        .from('log_credit_balances')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();

    if (error) {
        console.error('[getCreditBalance] supabase error:', error);
        return 0;
    }
    return data?.balance ?? 0;
};

/**
 * 自分の購入履歴を新しい順で取得する（026 / FR-014）。
 * pending（決済未完了）は履歴に出さず、completed / refunded / failed のうち
 * ユーザーにとって意味のある completed / refunded のみ返す
 */
export const getPurchaseHistory = async (): Promise<Purchase[]> => {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('log_credit_purchases')
        .select('id, quantity, amount_jpy, status, created_at')
        .in('status', ['completed', 'refunded'])
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[getPurchaseHistory] supabase error:', error);
        return [];
    }

    return (data ?? []).map((row) => ({
        id: row.id,
        quantity: row.quantity,
        amountJpy: row.amount_jpy,
        status: row.status as PurchaseStatus,
        purchasedAt: row.created_at,
    }));
};
