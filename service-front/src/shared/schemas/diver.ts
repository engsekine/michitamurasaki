import * as yup from 'yup';

import { DIVER_TYPE_VALUES, type DiverType } from '@/shared/constants/diver-type';

/**
 * ダイバー番号フィールド（019-diver-type）。
 * **種別がインストラクターのときのみ** 有効で、それ以外は出力から除外（strip）する。
 * 空文字は null に正規化し、DB の長さ CHECK（1..50）と矛盾しないようにする。
 */
const diverNumberField = yup
    .string()
    .trim()
    .nullable()
    .transform((value) => (value === '' ? null : value))
    .max(50, 'ダイバー番号は50文字以内で入力してください')
    // 種別がインストラクターのときだけ番号を保持し、それ以外は出力から除外（strip）する
    .when('diverType', ([diverType], schema) => (diverType === 'instructor' ? schema : schema.strip()));

const TYPE_MESSAGE = 'ダイバー種別を選択してください';

/**
 * 新規登録（メール / Google 初回）用のダイバーフィールド。種別は**必須**。
 * yup.object へスプレッドして使う（`diverNumber` の `.when` が同一オブジェクトの `diverType` を参照）。
 */
export const requiredDiverFields = {
    diverType: yup
        .mixed<DiverType>()
        .oneOf([...DIVER_TYPE_VALUES], TYPE_MESSAGE)
        .required(TYPE_MESSAGE),
    diverNumber: diverNumberField,
};

/**
 * プロフィール編集用のダイバーフィールド。種別は**任意**（未選択のまま保存可・既存ユーザー非ブロック）。
 */
export const optionalDiverFields = {
    diverType: yup
        .mixed<DiverType>()
        .oneOf([...DIVER_TYPE_VALUES], TYPE_MESSAGE)
        .nullable()
        .optional(),
    diverNumber: diverNumberField,
};
