'use server';

import { revalidatePath } from 'next/cache';

import { DEFAULT_PACKING_ITEMS } from '@/features/plans/lib/default-packing-items';
import { type PlanFormValues, packingItemSchema, planSchema } from '@/features/plans/schemas/plan.schema';
import { requireUser } from '@/shared/lib/auth';
import { todayInJst } from '@/shared/lib/date';
import { createClient } from '@/shared/lib/supabase/server';
import { validateWithSchema } from '@/shared/lib/validation';
import { type ActionResult, actionFailure, actionSuccess } from '@/shared/types/action-result';

/** PlanFormValues を DB の snake_case にマッピング */
const toDbRow = (input: PlanFormValues) => ({
    planned_on: input.plannedOn,
    location: input.location,
    notes: input.notes,
    dive_shop_id: input.diveShopId,
});

/**
 * 紐付けるショップが本人所有か検証する（033 / FR-007）。
 * RLS により他人のショップは SELECT できないため、取得できなければ不正 id とみなす。
 * DB 側の ensure_dive_shop_owned トリガーと合わせた二重ガード。
 */
const isOwnShop = async (supabase: Awaited<ReturnType<typeof createClient>>, diveShopId: string | null) => {
    if (!diveShopId) return true;
    const { data } = await supabase.from('dive_shops').select('id').eq('id', diveShopId).maybeSingle();
    return data !== null;
};

/** 予定関連の表示を再検証（一覧・詳細・TOP の「次の予定」カード） */
const revalidatePlanPaths = (id?: string) => {
    revalidatePath('/plans');
    if (id) revalidatePath(`/plans/${id}`);
    revalidatePath('/');
};

/**
 * 予定を作成し、デフォルト持ち物を一括展開する（FR-002 / FR-011）。
 * 持ち物の展開に失敗した場合は作成した予定を削除し、中途半端な状態を残さない。
 */
export const createPlan = async (rawInput: PlanFormValues): Promise<ActionResult<{ id: string }>> => {
    const supabase = await createClient();

    const { user, failure } = await requireUser(supabase);
    if (failure) return failure;

    // Server Action は任意クライアントから直接呼べるため、DB 書き込み前にサーバー側で再検証する
    const validated = await validateWithSchema(planSchema, rawInput);
    if (validated.error !== undefined) return actionFailure(validated.error);
    const input: PlanFormValues = validated.values;

    if (!(await isOwnShop(supabase, input.diveShopId))) {
        return actionFailure('選択したショップが見つかりません');
    }

    const { data, error } = await supabase
        .from('dive_plans')
        .insert({ ...toDbRow(input), user_id: user.id })
        .select('id')
        .single();

    if (error || !data) {
        console.error('[createPlan] supabase error:', error);
        return actionFailure('予定の作成に失敗しました。時間をおいて再度お試しください');
    }

    const defaultItems = DEFAULT_PACKING_ITEMS.map((name, index) => ({
        plan_id: data.id,
        name,
        position: index,
    }));
    const { error: itemsError } = await supabase.from('plan_packing_items').insert(defaultItems);

    if (itemsError) {
        console.error('[createPlan] packing items error:', itemsError);
        await supabase.from('dive_plans').delete().eq('id', data.id);
        return actionFailure('予定の作成に失敗しました。時間をおいて再度お試しください');
    }

    revalidatePlanPaths(data.id);
    return actionSuccess({ id: data.id });
};

/** 予定を更新する（FR-004） */
export const updatePlan = async (id: string, rawInput: PlanFormValues): Promise<ActionResult> => {
    const supabase = await createClient();

    const { failure } = await requireUser(supabase);
    if (failure) return failure;

    const validated = await validateWithSchema(planSchema, rawInput);
    if (validated.error !== undefined) return actionFailure(validated.error);
    const input: PlanFormValues = validated.values;

    if (!(await isOwnShop(supabase, input.diveShopId))) {
        return actionFailure('選択したショップが見つかりません');
    }

    const { error } = await supabase.from('dive_plans').update(toDbRow(input)).eq('id', id);

    if (error) {
        console.error('[updatePlan] supabase error:', error);
        return actionFailure('予定の更新に失敗しました。時間をおいて再度お試しください');
    }

    revalidatePlanPaths(id);
    return actionSuccess();
};

/** 予定を削除する。持ち物は FK の on delete cascade で連動削除される（FR-004 / FR-014） */
export const deletePlan = async (id: string): Promise<ActionResult> => {
    const supabase = await createClient();

    const { failure } = await requireUser(supabase);
    if (failure) return failure;

    const { error } = await supabase.from('dive_plans').delete().eq('id', id);

    if (error) {
        console.error('[deletePlan] supabase error:', error);
        return actionFailure('予定の削除に失敗しました。時間をおいて再度お試しください');
    }

    revalidatePlanPaths();
    return actionSuccess();
};

/** 持ち物項目のチェック状態を切り替える（FR-012） */
export const togglePackingItem = async (itemId: string, isChecked: boolean): Promise<ActionResult> => {
    const supabase = await createClient();

    const { failure } = await requireUser(supabase);
    if (failure) return failure;

    const { error } = await supabase.from('plan_packing_items').update({ is_checked: isChecked }).eq('id', itemId);

    if (error) {
        console.error('[togglePackingItem] supabase error:', error);
        return actionFailure('チェック状態の保存に失敗しました。時間をおいて再度お試しください');
    }

    revalidatePlanPaths();
    return actionSuccess();
};

/**
 * 持ち物準備を完了にし、忘れ物確認フェーズへ移行する（037 / FR-001〜003）。
 * 準備チェック（is_checked）の状態は問わない（FR-002）。UI 側の非表示と合わせた二重ガード。
 */
export const completePacking = async (planId: string): Promise<ActionResult> => {
    const supabase = await createClient();

    const { failure } = await requireUser(supabase);
    if (failure) return failure;

    // 所有チェックは RLS に委ねる（他人の予定は取得できず「見つかりません」になる）
    const { data: plan, error: planError } = await supabase
        .from('dive_plans')
        .select('id, planned_on, packing_completed_at, plan_packing_items(id)')
        .eq('id', planId)
        .maybeSingle();

    if (planError) {
        console.error('[completePacking] supabase error:', planError);
        return actionFailure('完了の保存に失敗しました。時間をおいて再度お試しください');
    }
    if (!plan) return actionFailure('予定が見つかりません');
    if (plan.planned_on < todayInJst()) return actionFailure('終了済みの予定では完了できません');
    if (plan.plan_packing_items.length === 0) return actionFailure('持ち物がないため完了できません');
    // 完了済みへの再実行は状態を変えず成功扱い（冪等）
    if (plan.packing_completed_at) return actionSuccess();

    const { error } = await supabase
        .from('dive_plans')
        .update({ packing_completed_at: new Date().toISOString() })
        .eq('id', planId);

    if (error) {
        console.error('[completePacking] supabase error:', error);
        return actionFailure('完了の保存に失敗しました。時間をおいて再度お試しください');
    }

    revalidatePlanPaths(planId);
    return actionSuccess();
};

/**
 * 完了を解除し、通常の持ち物リストへ戻す（037 / FR-005）。
 * 忘れ物確認の確認状態は破棄する（Clarifications Q1）。準備チェック（is_checked）は変更しない。
 */
export const uncompletePacking = async (planId: string): Promise<ActionResult> => {
    const supabase = await createClient();

    const { failure } = await requireUser(supabase);
    if (failure) return failure;

    const { data: plan, error: planError } = await supabase
        .from('dive_plans')
        .select('id, packing_completed_at')
        .eq('id', planId)
        .maybeSingle();

    if (planError) {
        console.error('[uncompletePacking] supabase error:', planError);
        return actionFailure('解除に失敗しました。時間をおいて再度お試しください');
    }
    if (!plan) return actionFailure('予定が見つかりません');
    // 未完了への解除は状態を変えず成功扱い（冪等）
    if (!plan.packing_completed_at) return actionSuccess();

    const { error: planUpdateError } = await supabase
        .from('dive_plans')
        .update({ packing_completed_at: null })
        .eq('id', planId);

    if (planUpdateError) {
        console.error('[uncompletePacking] supabase error:', planUpdateError);
        return actionFailure('解除に失敗しました。時間をおいて再度お試しください');
    }

    // 確認状態のリセット（Q1）。失敗しても解除自体は成立しており、次の完了時に UI 上は未確認から始まる
    const { error: itemsUpdateError } = await supabase
        .from('plan_packing_items')
        .update({ is_confirmed: false })
        .eq('plan_id', planId);

    if (itemsUpdateError) {
        console.error('[uncompletePacking] supabase error (reset confirmations):', itemsUpdateError);
    }

    revalidatePlanPaths(planId);
    return actionSuccess();
};

/**
 * 忘れ物確認リストの項目の確認状態を切り替える（037 / FR-006）。
 * 親予定が完了中かつ終了済みでない場合のみ操作できる（FR-009）。
 */
export const toggleConfirmItem = async (itemId: string, isConfirmed: boolean): Promise<ActionResult> => {
    const supabase = await createClient();

    const { failure } = await requireUser(supabase);
    if (failure) return failure;

    // 親予定の状態を join で取得（所有チェックは RLS に委ねる）
    const { data: item, error: itemError } = await supabase
        .from('plan_packing_items')
        .select('id, dive_plans(id, planned_on, packing_completed_at)')
        .eq('id', itemId)
        .maybeSingle();

    if (itemError) {
        console.error('[toggleConfirmItem] supabase error:', itemError);
        return actionFailure('確認状態の保存に失敗しました。時間をおいて再度お試しください');
    }
    if (!item?.dive_plans) return actionFailure('持ち物が見つかりません');
    if (!item.dive_plans.packing_completed_at) return actionFailure('準備完了後に確認できます');
    if (item.dive_plans.planned_on < todayInJst()) return actionFailure('終了済みの予定では操作できません');

    const { error } = await supabase.from('plan_packing_items').update({ is_confirmed: isConfirmed }).eq('id', itemId);

    if (error) {
        console.error('[toggleConfirmItem] supabase error:', error);
        return actionFailure('確認状態の保存に失敗しました。時間をおいて再度お試しください');
    }

    revalidatePlanPaths(item.dive_plans.id);
    return actionSuccess();
};

/** 持ち物のカスタム項目を末尾に追加する（FR-013） */
export const addPackingItem = async (planId: string, rawName: string): Promise<ActionResult<{ id: string }>> => {
    const supabase = await createClient();

    const { failure } = await requireUser(supabase);
    if (failure) return failure;

    // 項目名の長さ・型をサーバー側で再検証する（クライアント検証は信頼しない）
    const validated = await validateWithSchema(packingItemSchema, { name: rawName });
    if (validated.error !== undefined) return actionFailure(validated.error);
    const { name } = validated.values;

    const { data: last, error: lastError } = await supabase
        .from('plan_packing_items')
        .select('position')
        .eq('plan_id', planId)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (lastError) {
        console.error('[addPackingItem] supabase error:', lastError);
        return actionFailure('項目の追加に失敗しました。時間をおいて再度お試しください');
    }

    const { data, error } = await supabase
        .from('plan_packing_items')
        .insert({ plan_id: planId, name, position: (last?.position ?? -1) + 1 })
        .select('id')
        .single();

    if (error || !data) {
        console.error('[addPackingItem] supabase error:', error);
        return actionFailure('項目の追加に失敗しました。時間をおいて再度お試しください');
    }

    revalidatePlanPaths(planId);
    return actionSuccess({ id: data.id });
};

/** 持ち物項目を削除する（FR-013） */
export const deletePackingItem = async (itemId: string): Promise<ActionResult> => {
    const supabase = await createClient();

    const { failure } = await requireUser(supabase);
    if (failure) return failure;

    const { error } = await supabase.from('plan_packing_items').delete().eq('id', itemId);

    if (error) {
        console.error('[deletePackingItem] supabase error:', error);
        return actionFailure('項目の削除に失敗しました。時間をおいて再度お試しください');
    }

    revalidatePlanPaths();
    return actionSuccess();
};
