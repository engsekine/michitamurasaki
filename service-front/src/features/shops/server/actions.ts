'use server';

import { revalidatePath } from 'next/cache';

import { geocode } from '@/features/shops/lib/geocode';
import { type ShopFormValues, shopSchema } from '@/features/shops/schemas/shop.schema';
import type { GeocodeResult } from '@/features/shops/types';
import { requireUser } from '@/shared/lib/auth';
import { createClient } from '@/shared/lib/supabase/server';
import { validateWithSchema } from '@/shared/lib/validation';
import { type ActionResult, actionFailure, actionSuccess } from '@/shared/types/action-result';

/** ShopFormValues を DB の snake_case にマッピング（座標は別途解決して合成する） */
const toDbRow = (input: ShopFormValues) => ({
    name: input.name,
    address: input.address,
    phone: input.phone,
    website_url: input.websiteUrl,
    memo: input.memo,
});

/** 住所を座標に解決する。空住所・解決失敗は null 座標（保存は妨げない: FR-013） */
const resolveCoordinates = async (address: string): Promise<{ latitude: number | null; longitude: number | null }> => {
    if (!address) return { latitude: null, longitude: null };

    const location = await geocode(address);
    return location ? { latitude: location.lat, longitude: location.lng } : { latitude: null, longitude: null };
};

/** ショップ関連の表示を再検証（一覧・詳細） */
const revalidateShopPaths = (id?: string) => {
    revalidatePath('/shops');
    if (id) revalidatePath(`/shops/${id}`);
};

/** ショップを登録する（FR-001）。住所ありは座標も解決して保存する（research.md Decision 2） */
export const createShop = async (input: ShopFormValues): Promise<ActionResult<{ id: string }>> => {
    const supabase = await createClient();

    const { user, failure } = await requireUser(supabase);
    if (failure) return failure;

    const validated = await validateWithSchema(shopSchema, input);
    if (validated.error !== undefined) return actionFailure(validated.error);

    const coordinates = await resolveCoordinates(validated.values.address);

    const { data, error } = await supabase
        .from('dive_shops')
        .insert({ ...toDbRow(validated.values), ...coordinates, user_id: user.id })
        .select('id')
        .single();

    if (error || !data) {
        console.error('[createShop] supabase error:', error);
        return actionFailure('ショップの登録に失敗しました。時間をおいて再度お試しください');
    }

    revalidateShopPaths(data.id);
    return actionSuccess({ id: data.id });
};

/** ショップを更新する（FR-004）。住所が変更されたときのみ再ジオコーディングする */
export const updateShop = async (id: string, input: ShopFormValues): Promise<ActionResult> => {
    const supabase = await createClient();

    const { failure } = await requireUser(supabase);
    if (failure) return failure;

    const validated = await validateWithSchema(shopSchema, input);
    if (validated.error !== undefined) return actionFailure(validated.error);

    const { data: current, error: fetchError } = await supabase
        .from('dive_shops')
        .select('address, latitude, longitude')
        .eq('id', id)
        .maybeSingle();

    if (fetchError || !current) {
        console.error('[updateShop] fetch error:', fetchError);
        return actionFailure('ショップが見つかりません');
    }

    const addressChanged = validated.values.address !== current.address;
    const coordinates = addressChanged
        ? await resolveCoordinates(validated.values.address)
        : { latitude: current.latitude, longitude: current.longitude };

    const { error } = await supabase
        .from('dive_shops')
        .update({ ...toDbRow(validated.values), ...coordinates })
        .eq('id', id);

    if (error) {
        console.error('[updateShop] supabase error:', error);
        return actionFailure('ショップの更新に失敗しました。時間をおいて再度お試しください');
    }

    revalidateShopPaths(id);
    return actionSuccess();
};

/** ショップを削除する（FR-005）。紐付け解除は DB の on delete set null に委ねる（FR-010） */
export const deleteShop = async (id: string): Promise<ActionResult> => {
    const supabase = await createClient();

    const { failure } = await requireUser(supabase);
    if (failure) return failure;

    const { error } = await supabase.from('dive_shops').delete().eq('id', id);

    if (error) {
        console.error('[deleteShop] supabase error:', error);
        return actionFailure('ショップの削除に失敗しました。時間をおいて再度お試しください');
    }

    revalidateShopPaths();
    return actionSuccess();
};

/**
 * 登録・編集画面の地図プレビュー用に住所を座標へ解決する（FR-011）。
 * 特定できない・API 障害・キー未設定はすべて null 座標の成功応答として返し、
 * フォーム側は「地図を表示できない」表示に切り替える（エラー扱いにしない: FR-013）。
 */
export const geocodeAddress = async (address: string): Promise<ActionResult<GeocodeResult>> => {
    const supabase = await createClient();

    const { failure } = await requireUser(supabase);
    if (failure) return failure;

    const coordinates = await resolveCoordinates(address.trim());
    return actionSuccess(coordinates);
};
