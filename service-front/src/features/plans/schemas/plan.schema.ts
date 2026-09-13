import * as yup from 'yup';

import {
    PACKING_ITEM_NAME_MAX_LENGTH,
    PLAN_LOCATION_MAX_LENGTH,
    PLAN_NOTES_MAX_LENGTH,
} from '@/features/plans/constants';

/**
 * YYYY-MM-DD 形式かつ実在する日付かチェック（過去日は許可 — 終了済み予定として表示される）。
 * 空は required に任せるため true を返す。
 */
const isValidPlannedOn = (value: string | undefined): boolean => {
    if (!value) return true;
    return !Number.isNaN(new Date(value).getTime());
};

export const planSchema = yup.object({
    plannedOn: yup
        .string()
        .matches(/^\d{4}-\d{2}-\d{2}$/, { message: '正しい日付を入力してください', excludeEmptyString: true })
        .test('valid-date', '正しい日付を入力してください', isValidPlannedOn)
        .required('予定日を入力してください'),
    location: yup
        .string()
        .trim()
        .min(1, 'ポイント名を入力してください')
        .max(PLAN_LOCATION_MAX_LENGTH, `ポイント名は${PLAN_LOCATION_MAX_LENGTH}文字以内で入力してください`)
        .required('ポイント名を入力してください'),
    notes: yup
        .string()
        .trim()
        .max(PLAN_NOTES_MAX_LENGTH, `メモは${PLAN_NOTES_MAX_LENGTH}文字以内で入力してください`)
        .transform((v) => (v === '' ? null : v))
        .nullable()
        .default(null),
    /** 紐付けるショップ（033）。未選択（空文字）は null に正規化する */
    diveShopId: yup
        .string()
        .transform((v) => (v === '' ? null : v))
        .nullable()
        .default(null),
});

export type PlanFormValues = yup.InferType<typeof planSchema>;

/** 持ち物カスタム項目の追加用スキーマ */
export const packingItemSchema = yup.object({
    name: yup
        .string()
        .trim()
        .min(1, '項目名を入力してください')
        .max(PACKING_ITEM_NAME_MAX_LENGTH, `項目名は${PACKING_ITEM_NAME_MAX_LENGTH}文字以内で入力してください`)
        .required('項目名を入力してください'),
});

export type PackingItemFormValues = yup.InferType<typeof packingItemSchema>;
