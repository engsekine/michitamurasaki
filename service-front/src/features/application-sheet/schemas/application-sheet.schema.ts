import * as yup from 'yup';

import {
    EMERGENCY_CONTACT_RELATION_MAX_LENGTH,
    FULL_NAME_MAX_LENGTH,
    LICENSE_RANK_MAX_LENGTH,
    MAX_FOOT_SIZE_CM,
    NEAREST_STATION_MAX_LENGTH,
    PHONE_MAX_LENGTH,
    RENTAL_ITEM_KEYS,
} from '../constants';
import type { ContactLensTypeValue, RentalItemKey, SheetFormValues, SheetGenderValue, YesNoValue } from '../types';

/** 任意テキスト項目（trim + 最大文字数のみ検証） */
const optionalText = (label: string, maxLength: number) =>
    yup.string().trim().max(maxLength, `${label}は${maxLength}文字以内で入力してください`).default('');

/** 電話番号項目（数字・ハイフンのみ。国際表記の + も許容） */
const phoneText = (label: string) =>
    yup
        .string()
        .trim()
        .matches(/^[0-9+-]*$/, `${label}は数字とハイフンで入力してください`)
        .max(PHONE_MAX_LENGTH, `${label}は${PHONE_MAX_LENGTH}文字以内で入力してください`)
        .default('');

/** 本数・年齢などの数字項目（空 = 未入力を許容） */
const countText = (label: string, maxDigits: number) =>
    yup
        .string()
        .matches(new RegExp(`^\\d{0,${maxDigits}}$`), `${label}は数字で入力してください`)
        .default('');

/** 有無ラジオ（'' = 未選択） */
const yesNoValue = () => yup.string().oneOf<YesNoValue>(['', 'yes', 'no']).default('');

/** 身長・体重（整数 3 桁 + 小数第 1 位まで） */
const bodyMeasureText = (label: string) =>
    yup
        .string()
        .matches(/^(\d{1,3}(\.\d)?)?$/, `${label}は数字で入力してください（小数第1位まで）`)
        .default('');

/** 全項目任意（FR-005）。数値系は入力欄の文字列のまま検証する */
export const applicationSheetSchema: yup.ObjectSchema<SheetFormValues> = yup.object({
    fullName: optionalText('氏名', FULL_NAME_MAX_LENGTH),
    age: countText('年齢', 3),
    birthOn: yup
        .string()
        .matches(/^\d{4}-\d{2}-\d{2}$/, { message: '生年月日を正しく入力してください', excludeEmptyString: true })
        .default(''),
    gender: yup.string().oneOf<SheetGenderValue>(['', 'male', 'female']).default(''),
    phone: phoneText('携帯電話'),
    emergencyContactRelation: optionalText('緊急連絡先の続柄', EMERGENCY_CONTACT_RELATION_MAX_LENGTH),
    emergencyContactPhone: phoneText('緊急連絡先の電話番号'),
    nearestStation: optionalText('最寄りの駅', NEAREST_STATION_MAX_LENGTH),
    licenseRank: optionalText('ライセンスランク', LICENSE_RANK_MAX_LENGTH),
    diveCount: countText('経験本数', 5),
    lastDiveYearMonth: yup
        .string()
        .trim()
        .matches(/^\d{4}年(0?[1-9]|1[0-2])月$/, {
            message: '最終ダイブ年月は「2026年7月」の形式で入力してください',
            excludeEmptyString: true,
        })
        .default(''),
    hasDrySuitExperience: yesNoValue(),
    drySuitDiveCount: countText('ドライスーツの経験本数', 5),
    // レンタルは「無」+ 省略 ON をデフォルトにする（FR-012。「有」を選ぶと品目・サイズ欄等が現れる）
    hasRental: yup.string().oneOf<YesNoValue>(['', 'yes', 'no']).default('no'),
    rentalItems: yup.array().of(yup.string().oneOf<RentalItemKey>(RENTAL_ITEM_KEYS).required()).default([]),
    omitRentalBlock: yup.boolean().default(true),
    heightCm: bodyMeasureText('身長'),
    weightKg: bodyMeasureText('体重'),
    footSizeCm: yup
        .string()
        .matches(/^(\d{1,2}(\.\d)?)?$/, '足のサイズは数字で入力してください（小数第1位まで）')
        .test(
            'positive-foot-size',
            '足のサイズは0より大きい値を入力してください',
            (value) => value === '' || value === undefined || Number(value) > 0,
        )
        .test(
            'max-foot-size',
            `足のサイズは${MAX_FOOT_SIZE_CM}cm以下で入力してください`,
            (value) => value === '' || value === undefined || Number(value) <= MAX_FOOT_SIZE_CM,
        )
        .default(''),
    hasContactLens: yesNoValue(),
    contactLensType: yup.string().oneOf<ContactLensTypeValue>(['', 'hard', 'soft', 'disposable']).default(''),
    needsPrescriptionMask: yesNoValue(),
    // 宛先ショップ（033）。選択肢には本人のショップのみが注入され、所有はサーバー側でも検証する
    diveShopId: yup.string().default(''),
});
