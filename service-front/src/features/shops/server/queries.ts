import 'server-only';

import {
    type LinkedDive,
    type LinkedPlan,
    mapShop,
    type Shop,
    type ShopListItem,
    type ShopOption,
} from '@/features/shops/types';
import { createClient } from '@/shared/lib/supabase/server';

/**
 * 自分のショップ一覧を名前昇順で全件取得（FR-003）。
 * 一覧カードの表示項目のみに select を絞る（`rules/sql.md`: SELECT * を避ける）。
 * 件数はユーザーあたり数十件想定のためページネーションしない（plan.md Scale/Scope）。
 */
export const getShops = async (): Promise<ShopListItem[]> => {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('dive_shops')
        .select('id, name, address, phone')
        .order('name', { ascending: true });

    if (error || !data) {
        throw new Error(`[getShops] supabase error: ${error?.message ?? 'no data'}`);
    }

    return data;
};

/** ショップ 1 件取得。データなし（RLS により他人の id を含む）は null（404 セマンティクス） */
export const getShop = async (id: string): Promise<Shop | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase.from('dive_shops').select('*').eq('id', id).maybeSingle();

    if (error) {
        throw new Error(`[getShop] supabase error: ${error.message}`);
    }

    return data ? mapShop(data) : null;
};

/**
 * フォームの選択肢用の軽量一覧（research.md Decision 5）。
 * 予定・ログ・申し込みシートの page から取得し、各フォームへ props 注入する。
 */
export const getShopOptions = async (): Promise<ShopOption[]> => {
    const supabase = await createClient();

    const { data, error } = await supabase.from('dive_shops').select('id, name').order('name', { ascending: true });

    if (error || !data) {
        throw new Error(`[getShopOptions] supabase error: ${error?.message ?? 'no data'}`);
    }

    return data;
};

/**
 * ショップ詳細の逆引き一覧（FR-016）。予定は予定日降順・ログは潜水日降順。
 * 前提: shopId は呼び出し元で本人所有を確認済みであること（詳細ページは getShop → notFound でガード）。
 * dive_plans / dives の RLS が本人行に限定するため、他人の id を渡しても他人のデータは返らない。
 */
export const getLinkedRecords = async (shopId: string): Promise<{ plans: LinkedPlan[]; dives: LinkedDive[] }> => {
    const supabase = await createClient();

    const [plansResult, divesResult] = await Promise.all([
        supabase
            .from('dive_plans')
            .select('id, planned_on, location')
            .eq('dive_shop_id', shopId)
            .order('planned_on', { ascending: false }),
        supabase
            .from('dives')
            .select('id, dive_date, location')
            .eq('dive_shop_id', shopId)
            .order('dive_date', { ascending: false }),
    ]);

    if (plansResult.error || !plansResult.data) {
        throw new Error(`[getLinkedRecords] plans error: ${plansResult.error?.message ?? 'no data'}`);
    }
    if (divesResult.error || !divesResult.data) {
        throw new Error(`[getLinkedRecords] dives error: ${divesResult.error?.message ?? 'no data'}`);
    }

    return {
        plans: plansResult.data.map((row) => ({ id: row.id, plannedOn: row.planned_on, location: row.location })),
        dives: divesResult.data.map((row) => ({ id: row.id, diveDate: row.dive_date, location: row.location ?? '' })),
    };
};
