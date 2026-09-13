'use server';

import { revalidatePath } from 'next/cache';

import { requireUser } from '@/shared/lib/auth';
import { createClient } from '@/shared/lib/supabase/server';
import { validateWithSchema } from '@/shared/lib/validation';
import { type ActionResult, actionFailure, actionSuccess } from '@/shared/types/action-result';

import { BASE_PROFILE_SHEET_NAME, MAX_APPLICATION_SHEETS, SHEET_NAME_MAX_LENGTH } from '../constants';
import { displayToYearMonth } from '../lib/yearMonth';
import { applicationSheetSchema } from '../schemas/application-sheet.schema';
import type { SheetFormValues, YesNoValue } from '../types';

interface SaveApplicationSheetInput {
    /** 上書き対象のシート ID。null なら新規保存 */
    sheetId: string | null;
    name: string;
    values: SheetFormValues;
}

/** 有無ラジオの値 → DB の nullable boolean（'' = 未入力は null） */
const toNullableBoolean = (value: YesNoValue): boolean | null => {
    if (value === 'yes') return true;
    if (value === 'no') return false;
    return null;
};

/** 数字文字列 → DB の nullable 数値（'' = 未入力は null） */
const toNullableNumber = (value: string): number | null => (value === '' ? null : Number(value));

/** フォーム全体のスナップショットを DB カラムへマッピングする */
const toDbRow = (name: string, values: SheetFormValues) => ({
    name,
    full_name: values.fullName,
    age: toNullableNumber(values.age),
    birth_on: values.birthOn === '' ? null : values.birthOn,
    gender: values.gender === '' ? null : values.gender,
    phone: values.phone,
    emergency_contact_relation: values.emergencyContactRelation,
    emergency_contact_phone: values.emergencyContactPhone,
    nearest_station: values.nearestStation,
    license_rank: values.licenseRank,
    dive_count: toNullableNumber(values.diveCount),
    // フォームの表示形式「2026年7月」→ DB の YYYY-MM
    last_dive_year_month: displayToYearMonth(values.lastDiveYearMonth),
    has_dry_suit_experience: toNullableBoolean(values.hasDrySuitExperience),
    dry_suit_dive_count: toNullableNumber(values.drySuitDiveCount),
    has_rental: toNullableBoolean(values.hasRental),
    rental_items: values.rentalItems,
    omit_rental_block: values.omitRentalBlock,
    height_cm: toNullableNumber(values.heightCm),
    weight_kg: toNullableNumber(values.weightKg),
    foot_size_cm: toNullableNumber(values.footSizeCm),
    has_contact_lens: toNullableBoolean(values.hasContactLens),
    contact_lens_type: values.contactLensType === '' ? null : values.contactLensType,
    needs_prescription_mask: toNullableBoolean(values.needsPrescriptionMask),
    dive_shop_id: values.diveShopId === '' ? null : values.diveShopId,
});

/**
 * 宛先ショップが本人所有か検証する（033 / FR-009）。
 * RLS により他人のショップは SELECT できないため、取得できなければ不正 id とみなす。
 * DB 側の ensure_dive_shop_owned トリガーと合わせた二重ガード。
 */
const isOwnShop = async (supabase: Awaited<ReturnType<typeof createClient>>, diveShopId: string) => {
    if (diveShopId === '') return true;
    const { data } = await supabase.from('dive_shops').select('id').eq('id', diveShopId).maybeSingle();
    return data !== null;
};

/**
 * 申し込みシートを名前付きで保存する（新規 or 上書き）。
 * 保存対象はフォーム全体のスナップショット。個人情報を扱うため、エラーログに入力値は含めない。
 */
export const saveApplicationSheet = async (input: SaveApplicationSheetInput): Promise<ActionResult<{ id: string }>> => {
    const supabase = await createClient();

    const { user, failure } = await requireUser(supabase);
    if (failure) return failure;

    const name = input.name.trim();
    if (name === '') return actionFailure('シート名を入力してください');
    if (name.length > SHEET_NAME_MAX_LENGTH) {
        return actionFailure(`シート名は${SHEET_NAME_MAX_LENGTH}文字以内で入力してください`);
    }

    const validation = await validateWithSchema(applicationSheetSchema, input.values);
    if (validation.error !== undefined) return actionFailure(validation.error);

    // 宛先ショップは本人所有のみ許可する（033 / FR-009）
    if (!(await isOwnShop(supabase, validation.values.diveShopId))) {
        return actionFailure('宛先ショップが見つかりません');
    }

    const row = toDbRow(name, validation.values);

    if (input.sheetId !== null) {
        // 上書き。RLS に加えて本人のシートであることを明示的に確認する
        const { data, error } = await supabase
            .from('application_sheets')
            .update(row)
            .eq('id', input.sheetId)
            .eq('user_id', user.id)
            .eq('kind', 'sheet')
            .select('id')
            .maybeSingle();

        if (error) {
            console.error('[saveApplicationSheet] supabase error code:', error.code);
            return actionFailure('保存に失敗しました。時間をおいて再度お試しください');
        }
        if (!data) return actionFailure('保存先のシートが見つかりません');

        revalidatePath('/application-sheet');
        return actionSuccess({ id: data.id });
    }

    // 新規保存。無制限な行増加を防ぐため上限件数を確認する（基本情報の行は数えない）
    const { count, error: countError } = await supabase
        .from('application_sheets')
        .select('id', { count: 'exact', head: true })
        .eq('kind', 'sheet');

    if (countError) {
        console.error('[saveApplicationSheet] supabase error code:', countError.code);
        return actionFailure('保存に失敗しました。時間をおいて再度お試しください');
    }
    if ((count ?? 0) >= MAX_APPLICATION_SHEETS) {
        return actionFailure(`保存できるシートは${MAX_APPLICATION_SHEETS}件までです。不要なシートを削除してください`);
    }

    const { data, error } = await supabase
        .from('application_sheets')
        .insert({ ...row, user_id: user.id })
        .select('id')
        .single();

    if (error || !data) {
        console.error('[saveApplicationSheet] supabase error code:', error?.code);
        return actionFailure('保存に失敗しました。時間をおいて再度お試しください');
    }

    revalidatePath('/application-sheet');
    return actionSuccess({ id: data.id });
};

/** 基本情報 + 経験セクションの値を DB カラムへマッピングする */
const toBaseProfileDbRow = (values: SheetFormValues) => ({
    full_name: values.fullName,
    age: toNullableNumber(values.age),
    birth_on: values.birthOn === '' ? null : values.birthOn,
    gender: values.gender === '' ? null : values.gender,
    phone: values.phone,
    emergency_contact_relation: values.emergencyContactRelation,
    emergency_contact_phone: values.emergencyContactPhone,
    nearest_station: values.nearestStation,
    license_rank: values.licenseRank,
    dive_count: toNullableNumber(values.diveCount),
    last_dive_year_month: displayToYearMonth(values.lastDiveYearMonth),
    has_dry_suit_experience: toNullableBoolean(values.hasDrySuitExperience),
    dry_suit_dive_count: toNullableNumber(values.drySuitDiveCount),
});

/**
 * 基本情報 + 経験（1 ユーザー 1 件・application_sheets の kind='base' 行）を保存する。
 * 新規シート作成時の自動入力に使う。個人情報を扱うため、エラーログに入力値は含めない。
 */
export const saveApplicationBaseProfile = async (input: SheetFormValues): Promise<ActionResult> => {
    const supabase = await createClient();

    const { user, failure } = await requireUser(supabase);
    if (failure) return failure;

    const validation = await validateWithSchema(applicationSheetSchema, input);
    if (validation.error !== undefined) return actionFailure(validation.error);

    const row = toBaseProfileDbRow(validation.values);

    // kind='base' は 1 ユーザー 1 件（部分ユニーク制約）。まず更新し、無ければ作成する
    const { data: updated, error: updateError } = await supabase
        .from('application_sheets')
        .update(row)
        .eq('kind', 'base')
        .eq('user_id', user.id)
        .select('id')
        .maybeSingle();

    if (updateError) {
        console.error('[saveApplicationBaseProfile] supabase error code:', updateError.code);
        return actionFailure('基本情報の保存に失敗しました。時間をおいて再度お試しください');
    }

    if (!updated) {
        const { error: insertError } = await supabase
            .from('application_sheets')
            .insert({ ...row, kind: 'base', name: BASE_PROFILE_SHEET_NAME, user_id: user.id });

        if (insertError) {
            console.error('[saveApplicationBaseProfile] supabase error code:', insertError.code);
            return actionFailure('基本情報の保存に失敗しました。時間をおいて再度お試しください');
        }
    }

    revalidatePath('/application-sheet');
    return actionSuccess();
};

/** 保存済みシートを削除する（本人のシートのみ） */
export const deleteApplicationSheet = async (sheetId: string): Promise<ActionResult> => {
    const supabase = await createClient();

    const { user, failure } = await requireUser(supabase);
    if (failure) return failure;

    const { error } = await supabase.from('application_sheets').delete().eq('id', sheetId).eq('user_id', user.id);

    if (error) {
        console.error('[deleteApplicationSheet] supabase error code:', error.code);
        return actionFailure('削除に失敗しました。時間をおいて再度お試しください');
    }

    revalidatePath('/application-sheet');
    return actionSuccess();
};
