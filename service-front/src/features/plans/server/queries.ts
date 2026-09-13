import 'server-only';

import { daysUntil } from '@/features/plans/lib/days-until';
import { mapPackingItem, mapPlan, type NextPlanSummary, type Plan, type PlanWithPacking } from '@/features/plans/types';
import { todayInJst } from '@/shared/lib/date';
import { createClient } from '@/shared/lib/supabase/server';

/**
 * 自分の予定を予定日昇順で全件取得（FR-001）。
 * 件数はユーザーあたり高々数十件想定のためページネーションしない（research.md Decision 1）。
 */
export const listPlans = async (): Promise<Plan[]> => {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('dive_plans')
        .select('*')
        .order('planned_on', { ascending: true })
        .order('created_at', { ascending: false });

    if (error || !data) {
        throw new Error(`[listPlans] supabase error: ${error?.message ?? 'no data'}`);
    }

    return data.map(mapPlan);
};

/** 自分の予定を持ち物込みで 1 件取得。データなし（RLS 含む）は null（404 セマンティクス） */
export const getPlan = async (id: string): Promise<PlanWithPacking | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('dive_plans')
        .select('*, plan_packing_items(*), dive_shops(id, name)')
        .eq('id', id)
        .maybeSingle();

    if (error) {
        throw new Error(`[getPlan] supabase error: ${error.message}`);
    }
    if (!data) return null;

    const { plan_packing_items: itemRows, dive_shops: shopRow, ...planRow } = data;
    const packingItems = [...itemRows].sort((a, b) => a.position - b.position).map(mapPackingItem);

    return {
        ...mapPlan(planRow),
        packingItems,
        packingCompletedAt: planRow.packing_completed_at,
        shop: shopRow ? { id: shopRow.id, name: shopRow.name } : null,
    };
};

/**
 * 今日以降（今日含む）の予定 + 持ち物全件を近い順に取得する（FR-007 / FR-009)。
 * TOP「次の予定」は limit で件数を絞り、予定一覧（/plans）の「これからの予定」は
 * limit 省略で全件取得する。同日複数は作成日時が新しい方を優先（spec Edge Case）。予定なしは []。
 * 持ち物はカード上でチェック操作するため全件返す（進捗は表示側で集計する）。
 */
export const listNextPlansWithProgress = async (limit?: number): Promise<NextPlanSummary[]> => {
    const supabase = await createClient();
    const today = todayInJst();

    const query = supabase
        .from('dive_plans')
        .select('id, planned_on, location, notes, packing_completed_at, plan_packing_items(*)')
        .gte('planned_on', today)
        .order('planned_on', { ascending: true })
        .order('created_at', { ascending: false });

    // limit 省略時は全件（/plans の「これからの予定」用）
    const { data, error } = await (limit === undefined ? query : query.limit(limit));

    if (error || !data) {
        throw new Error(`[listNextPlansWithProgress] supabase error: ${error?.message ?? 'no data'}`);
    }

    return data.map((row) => ({
        id: row.id,
        plannedOn: row.planned_on,
        location: row.location,
        notes: row.notes,
        daysUntil: daysUntil(row.planned_on, today),
        packingItems: [...row.plan_packing_items].sort((a, b) => a.position - b.position).map(mapPackingItem),
        packingCompletedAt: row.packing_completed_at,
    }));
};
