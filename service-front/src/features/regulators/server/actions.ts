'use server';

import { revalidatePath } from 'next/cache';

import { type RegulatorFormValues, regulatorSchema } from '@/features/regulators/schemas/regulator.schema';
import { requireUser } from '@/shared/lib/auth';
import { todayInJst } from '@/shared/lib/date';
import { createClient } from '@/shared/lib/supabase/server';
import { validateWithSchema } from '@/shared/lib/validation';
import { type ActionResult, actionFailure, actionSuccess } from '@/shared/types/action-result';

/** RegulatorFormValues を DB の snake_case にマッピング */
const toDbRow = (input: RegulatorFormValues) => ({
    brand: input.brand,
    model: input.model,
    purchased_on: input.purchasedOn,
    last_overhauled_on: input.lastOverhauledOn,
    overhaul_interval_months: input.overhaulIntervalMonths,
    overhaul_interval_dives: input.overhaulIntervalDives,
    is_primary: input.isPrimary,
    notes: input.notes,
});

/** 機材関連の表示を再検証（TOP の OH パネル + 設定画面） */
const revalidateRegulatorPaths = () => {
    revalidatePath('/');
    revalidatePath('/settings/equipment');
};

/**
 * メイン機材は 1 ユーザー 1 件（部分ユニーク制約）。
 * is_primary を立てる場合は既存のメイン機材を先に解除して制約違反を防ぐ。
 */
const demoteCurrentPrimary = async (
    supabase: Awaited<ReturnType<typeof createClient>>,
    excludeId?: string,
): Promise<{ message: string } | null> => {
    let query = supabase.from('regulators').update({ is_primary: false }).eq('is_primary', true);
    if (excludeId) query = query.neq('id', excludeId);

    const { error } = await query;
    return error ? { message: error.message } : null;
};

/**
 * レギュレーターを登録する（FR-008）。
 * 最初の 1 台は自動的にメイン機材になる（FR-011）。
 */
export const createRegulator = async (input: RegulatorFormValues): Promise<ActionResult<{ id: string }>> => {
    const supabase = await createClient();

    const { user, failure } = await requireUser(supabase);
    if (failure) return failure;

    const validated = await validateWithSchema(regulatorSchema, input);
    if (validated.error !== undefined) return actionFailure(validated.error);
    const values = validated.values;

    const { count, error: countError } = await supabase.from('regulators').select('id', { count: 'exact', head: true });

    if (countError) {
        console.error('[createRegulator] supabase error:', countError);
        return actionFailure('機材の登録に失敗しました。時間をおいて再度お試しください');
    }

    const isFirst = (count ?? 0) === 0;
    const isPrimary = isFirst || values.isPrimary;

    if (!isFirst && values.isPrimary) {
        const demoteError = await demoteCurrentPrimary(supabase);
        if (demoteError) {
            console.error('[createRegulator] demote error:', demoteError);
            return actionFailure('機材の登録に失敗しました。時間をおいて再度お試しください');
        }
    }

    const { data, error } = await supabase
        .from('regulators')
        .insert({ ...toDbRow(values), is_primary: isPrimary, user_id: user.id })
        .select('id')
        .single();

    if (error || !data) {
        console.error('[createRegulator] supabase error:', error);
        return actionFailure('機材の登録に失敗しました。時間をおいて再度お試しください');
    }

    revalidateRegulatorPaths();
    return actionSuccess({ id: data.id });
};

/** レギュレーターを更新する（FR-009） */
export const updateRegulator = async (id: string, input: RegulatorFormValues): Promise<ActionResult> => {
    const supabase = await createClient();

    const { user, failure } = await requireUser(supabase);
    if (failure) return failure;

    const validated = await validateWithSchema(regulatorSchema, input);
    if (validated.error !== undefined) return actionFailure(validated.error);
    const values = validated.values;

    if (values.isPrimary) {
        const demoteError = await demoteCurrentPrimary(supabase, id);
        if (demoteError) {
            console.error('[updateRegulator] demote error:', demoteError);
            return actionFailure('機材の更新に失敗しました。時間をおいて再度お試しください');
        }
    }

    const { error } = await supabase.from('regulators').update(toDbRow(values)).eq('id', id).eq('user_id', user.id);

    if (error) {
        console.error('[updateRegulator] supabase error:', error);
        return actionFailure('機材の更新に失敗しました。時間をおいて再度お試しください');
    }

    revalidateRegulatorPaths();
    return actionSuccess();
};

/** レギュレーターを削除する（FR-009） */
export const deleteRegulator = async (id: string): Promise<ActionResult> => {
    const supabase = await createClient();

    const { user, failure } = await requireUser(supabase);
    if (failure) return failure;

    const { error } = await supabase.from('regulators').delete().eq('id', id).eq('user_id', user.id);

    if (error) {
        console.error('[deleteRegulator] supabase error:', error);
        return actionFailure('機材の削除に失敗しました。時間をおいて再度お試しください');
    }

    revalidateRegulatorPaths();
    return actionSuccess();
};

/** OH 完了を記録する: last_overhauled_on を JST の今日に更新（FR-017） */
export const recordOverhaul = async (regulatorId: string): Promise<ActionResult> => {
    const supabase = await createClient();

    const { user, failure } = await requireUser(supabase);
    if (failure) return failure;

    const { error } = await supabase
        .from('regulators')
        .update({ last_overhauled_on: todayInJst() })
        .eq('id', regulatorId)
        .eq('user_id', user.id);

    if (error) {
        console.error('[recordOverhaul] supabase error:', error);
        return actionFailure('メンテ完了の記録に失敗しました。時間をおいて再度お試しください');
    }

    revalidateRegulatorPaths();
    return actionSuccess();
};
