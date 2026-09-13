import * as yup from 'yup';

import {
    SHOP_ADDRESS_MAX_LENGTH,
    SHOP_MEMO_MAX_LENGTH,
    SHOP_NAME_MAX_LENGTH,
    SHOP_PHONE_MAX_LENGTH,
    SHOP_WEBSITE_URL_MAX_LENGTH,
} from '@/features/shops/constants';

/** 電話番号として許可する文字（数字・ハイフン・先頭 +）。厳密な桁数検証はしない */
const PHONE_PATTERN = /^\+?[0-9-]+$/;

/** http(s) の URL のみ許可（javascript: 等のスキームを弾く） */
const HTTP_URL_PATTERN = /^https?:\/\/\S+$/;

export const shopSchema = yup.object({
    name: yup
        .string()
        .trim()
        .min(1, 'ショップ名を入力してください')
        .max(SHOP_NAME_MAX_LENGTH, `ショップ名は${SHOP_NAME_MAX_LENGTH}文字以内で入力してください`)
        .required('ショップ名を入力してください'),
    address: yup
        .string()
        .trim()
        .max(SHOP_ADDRESS_MAX_LENGTH, `住所は${SHOP_ADDRESS_MAX_LENGTH}文字以内で入力してください`)
        .default(''),
    phone: yup
        .string()
        .trim()
        .matches(PHONE_PATTERN, { message: '電話番号は数字・ハイフン・+ で入力してください', excludeEmptyString: true })
        .max(SHOP_PHONE_MAX_LENGTH, `電話番号は${SHOP_PHONE_MAX_LENGTH}文字以内で入力してください`)
        .default(''),
    websiteUrl: yup
        .string()
        .trim()
        .matches(HTTP_URL_PATTERN, {
            message: 'Web サイト URL は http(s):// から始まる URL を入力してください',
            excludeEmptyString: true,
        })
        .max(SHOP_WEBSITE_URL_MAX_LENGTH, `Web サイト URL は${SHOP_WEBSITE_URL_MAX_LENGTH}文字以内で入力してください`)
        .default(''),
    memo: yup
        .string()
        .trim()
        .max(SHOP_MEMO_MAX_LENGTH, `メモは${SHOP_MEMO_MAX_LENGTH}文字以内で入力してください`)
        .default(''),
});

export type ShopFormValues = yup.InferType<typeof shopSchema>;
