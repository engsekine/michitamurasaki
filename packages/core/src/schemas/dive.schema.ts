import * as yup from 'yup';

import { DIVE_TYPE_OPTIONS, TANK_TYPE_OPTIONS } from '../constants/dive-options';
import { todayInJst } from '../lib/date';
import { optionalNumber } from '../lib/transforms';

const TANK_TYPE_VALUES = TANK_TYPE_OPTIONS.map((option) => option.value);
const DIVE_TYPE_VALUE_SET = new Set<string>(DIVE_TYPE_OPTIONS.map((option) => option.value));

/**
 * YYYY-MM-DD の日付文字列が 1900-01-01 〜 日本時間の当日の範囲内かチェック。
 *
 * UTC 比較だと JST 早朝（UTC 前日）に「JST の今日」が未来扱いになるため、
 * 上限は日本時間の今日（YYYY-MM-DD）と文字列比較する。
 * ISO 形式は辞書順 = 時系列順なので文字列比較で正しく判定できる。
 */
const isDiveDateValid = (value: string | undefined): boolean => {
    if (!value) return false;
    if (Number.isNaN(new Date(value).getTime())) return false;
    return value >= '1900-01-01' && value <= todayInJst();
};

const optionalTime = yup
    .string()
    .transform((value) => (value === '' || value == null ? null : value))
    .nullable()
    .matches(/^\d{2}:\d{2}(:\d{2})?$/, { message: 'HH:MM 形式で入力してください', excludeEmptyString: true })
    .default(null);

export const diveSchema = yup.object({
    diveNumber: yup
        .number()
        .typeError('ダイブ番号は数値で入力してください')
        .transform(optionalNumber)
        .nullable()
        .integer('ダイブ番号は整数で入力してください')
        .min(0, 'ダイブ番号は0以上で入力してください')
        .default(null),
    diveDate: yup
        .string()
        .matches(/^\d{4}-\d{2}-\d{2}$/, '正しい日付を入力してください')
        .test('valid-range', '正しい日付を入力してください', isDiveDateValid)
        .required('潜水日を入力してください'),
    entryTime: optionalTime,
    exitTime: optionalTime,
    // ダイブサイト（マスタ）参照。未選択は null。location との排他は下のテストで担保
    diveSiteId: yup
        .string()
        .transform((v) => (v === '' ? null : v))
        .nullable()
        .test('not-both', 'ポイントは選択と手入力のどちらか一方にしてください', function (value) {
            const location = (this.parent as { location?: string | null }).location;
            return !(value && location);
        })
        .default(null),
    // 自由入力のポイント名。サイト未選択時のみ必須（マスタ参照と排他・同居）
    location: yup
        .string()
        .trim()
        .max(120, 'ポイント名は120文字以内で入力してください')
        .transform((v) => (v === '' ? null : v))
        .nullable()
        .test('site-or-location', 'ポイントを選択するか、ポイント名を入力してください', function (value) {
            const diveSiteId = (this.parent as { diveSiteId?: string | null }).diveSiteId;
            if (diveSiteId) return true;
            return value != null && value !== '';
        })
        .default(null),
    diveType: yup
        .string()
        .trim()
        .max(40, 'ダイブタイプは40文字以内で入力してください')
        .transform((v) => (v === '' ? null : v))
        .nullable()
        .default(null),
    weather: yup
        .string()
        .trim()
        .max(60, '天候は60文字以内で入力してください')
        .transform((v) => (v === '' ? null : v))
        .nullable()
        .default(null),
    airTempC: yup
        .number()
        .typeError('気温は数値で入力してください')
        .transform(optionalNumber)
        .nullable()
        .min(-30, '気温は-30℃以上で入力してください')
        .max(60, '気温は60℃以下で入力してください')
        .default(null),
    waterTempC: yup
        .number()
        .typeError('水温は数値で入力してください')
        .transform(optionalNumber)
        .nullable()
        .min(-5, '水温は-5℃以上で入力してください')
        .max(45, '水温は45℃以下で入力してください')
        .default(null),
    visibilityM: yup
        .number()
        .typeError('透明度は数値で入力してください')
        .transform(optionalNumber)
        .nullable()
        .min(0, '透明度は0m以上で入力してください')
        .max(100, '透明度は100m以下で入力してください')
        .default(null),
    wave: yup
        .string()
        .trim()
        .max(60, '波の状況は60文字以内で入力してください')
        .transform((v) => (v === '' ? null : v))
        .nullable()
        .default(null),
    currentCondition: yup
        .string()
        .trim()
        .max(60, '流れの状況は60文字以内で入力してください')
        .transform((v) => (v === '' ? null : v))
        .nullable()
        .default(null),
    maxDepthM: yup
        .number()
        .typeError('最大水深は数値で入力してください')
        .positive('最大水深は0より大きい値を入力してください')
        .max(300, '最大水深は300m以下で入力してください')
        .required('最大水深を入力してください'),
    avgDepthM: yup
        .number()
        .typeError('平均水深は数値で入力してください')
        .transform(optionalNumber)
        .nullable()
        .positive('平均水深は0より大きい値を入力してください')
        .max(300, '平均水深は300m以下で入力してください')
        .test('lte-max-depth', '平均水深は最大水深以下で入力してください', function (value) {
            if (value === null || value === undefined) return true;
            const maxDepth = (this.parent as { maxDepthM?: number | null }).maxDepthM;
            if (maxDepth === null || maxDepth === undefined) return true;
            return value <= maxDepth;
        })
        .default(null),
    bottomTimeMin: yup
        .number()
        .typeError('潜水時間は数値で入力してください')
        .integer('潜水時間は整数で入力してください')
        .min(1, '潜水時間は1分以上で入力してください')
        .max(1440, '潜水時間は1440分以下で入力してください')
        .required('潜水時間を入力してください'),
    tankType: yup
        .string()
        .transform((v) => (v === '' ? null : v))
        .nullable()
        .oneOf([null, ...TANK_TYPE_VALUES], 'タンク種別が正しくありません')
        .default('steel'),
    tankVolumeL: yup
        .number()
        .typeError('タンク容量は数値で入力してください')
        .transform(optionalNumber)
        .nullable()
        .positive('タンク容量は0より大きい値を入力してください')
        .max(50, 'タンク容量は50L以下で入力してください')
        .default(10),
    gasType: yup
        .string()
        .trim()
        .max(40, 'ガス種別は40文字以内で入力してください')
        .transform((v) => (v === '' ? null : v))
        .nullable()
        .default('air'),
    o2Percent: yup
        .number()
        .typeError('酸素濃度は数値で入力してください')
        .transform(optionalNumber)
        .nullable()
        .min(0, '酸素濃度は0%以上で入力してください')
        .max(100, '酸素濃度は100%以下で入力してください')
        .default(21),
    pressureStartBar: yup
        .number()
        .typeError('開始残圧は数値で入力してください')
        .transform(optionalNumber)
        .nullable()
        .integer('開始残圧は整数で入力してください')
        .min(0, '開始残圧は0bar以上で入力してください')
        .max(400, '開始残圧は400bar以下で入力してください')
        .default(null),
    pressureEndBar: yup
        .number()
        .typeError('終了残圧は数値で入力してください')
        .transform(optionalNumber)
        .nullable()
        .integer('終了残圧は整数で入力してください')
        .min(0, '終了残圧は0bar以上で入力してください')
        .max(400, '終了残圧は400bar以下で入力してください')
        .test('lte-pressure-start', '終了残圧は開始残圧以下で入力してください', function (value) {
            if (value === null || value === undefined) return true;
            const start = (this.parent as { pressureStartBar?: number | null }).pressureStartBar;
            if (start === null || start === undefined) return true;
            return value <= start;
        })
        .default(null),
    weightKg: yup
        .number()
        .typeError('ウェイトは数値で入力してください')
        .transform(optionalNumber)
        .nullable()
        .min(0, 'ウェイトは0kg以上で入力してください')
        .max(30, 'ウェイトは30kg以下で入力してください')
        .default(null),
    suitType: yup
        .string()
        .trim()
        .max(40, 'スーツ種別は40文字以内で入力してください')
        .transform((v) => (v === '' ? null : v))
        .nullable()
        .default(null),
    equipmentNotes: yup
        .string()
        .trim()
        .max(1000, '装備メモは1000文字以内で入力してください')
        .transform((v) => (v === '' ? null : v))
        .nullable()
        .default(null),
    buddyName: yup
        .string()
        .trim()
        .max(100, 'バディ名は100文字以内で入力してください')
        .transform((v) => (v === '' ? null : v))
        .nullable()
        .default(null),
    instructorName: yup
        .string()
        .trim()
        .max(100, 'インストラクター名は100文字以内で入力してください')
        .transform((v) => (v === '' ? null : v))
        .nullable()
        .default(null),
    certificationDive: yup.boolean().default(false).required(),
    notes: yup
        .string()
        .trim()
        .max(2000, 'メモ・印象は2000文字以内で入力してください')
        .transform((v) => (v === '' ? null : v))
        .nullable()
        .default(null),
    // 同行バディ（spec 021 FR-001〜003）: 登録ユーザー（userId）か名前（name）の
    // どちらか一方を持つ要素の配列。自分自身の除外は server / DB トリガで担保する。
    buddies: yup
        .array()
        .of(
            yup
                .object({
                    userId: yup
                        .string()
                        .transform((v) => (v === '' || v == null ? undefined : v))
                        .uuid('バディの指定が不正です')
                        .optional(),
                    name: yup
                        .string()
                        .trim()
                        .max(100, 'バディ名は100文字以内で入力してください')
                        .transform((v) => (v === '' || v == null ? undefined : v))
                        .optional(),
                    // 登録ユーザーの表示名（編集画面のチップ表示用・xor 判定の対象外）。
                    // サーバー同期では userId のみ使うため保存には影響しない。
                    nickname: yup.string().optional(),
                })
                .test('user-xor-name', 'バディは登録ユーザーか名前のどちらか一方を指定してください', (value) => {
                    const hasUser = Boolean(value?.userId);
                    const hasName = Boolean(value?.name);
                    return (hasUser && !hasName) || (!hasUser && hasName);
                }),
        )
        .default([]),
    // 公開フラグ（spec 021 FR-007/008）: 新規は既定で非公開
    isPublic: yup.boolean().default(false).required(),
    // 紐付けるショップ（033）。任意・未選択（空文字）は null に正規化する
    diveShopId: yup
        .string()
        .transform((v) => (v === '' ? null : v))
        .nullable()
        .default(null),
});

export type DiveFormValues = yup.InferType<typeof diveSchema>;

/** 検索の任意日付（YYYY-MM-DD・空は null）。形式のみ検証する */
const optionalSearchDate = yup
    .string()
    .transform((v) => (v === '' || v == null ? null : v))
    .nullable()
    .matches(/^\d{4}-\d{2}-\d{2}$/, { message: '正しい日付を入力してください', excludeEmptyString: true })
    .default(null);

/** 検索の任意深度（0〜300・空は null） */
const optionalSearchDepth = yup
    .number()
    .transform(optionalNumber)
    .nullable()
    .min(0, '深度は0以上で入力してください')
    .max(300, '深度は300以下で入力してください')
    .typeError('深度は数値で入力してください')
    .default(null);

/** 検索バー用の軽量スキーマ */
export const diveSearchSchema = yup.object({
    diveNumber: yup
        .number()
        .transform((v, orig) => (orig === '' || orig == null ? null : v))
        .nullable()
        .integer('ダイブ番号は整数で入力してください')
        .min(0, 'ダイブ番号は0以上で入力してください')
        .max(9999, 'ダイブ番号は9999以下で入力してください')
        .typeError('ダイブ番号は数値で入力してください')
        .default(null),
    // 期間（FR-001）: 開始日・終了日。終了日は開始日以降（片側のみ可）
    dateFrom: optionalSearchDate,
    dateTo: optionalSearchDate.test('date-range', '終了日は開始日以降の日付を指定してください', function (value) {
        const { dateFrom } = this.parent as { dateFrom?: string | null };
        if (!value || !dateFrom) return true;
        return value >= dateFrom;
    }),
    // 深度範囲（FR-002）: 下限・上限。上限は下限以上（片側のみ可）
    depthMin: optionalSearchDepth,
    depthMax: optionalSearchDepth.test('depth-range', '深度の上限は下限以上で入力してください', function (value) {
        const { depthMin } = this.parent as { depthMin?: number | null };
        if (value == null || depthMin == null) return true;
        return value >= depthMin;
    }),
    // ダイブタイプ（FR-003）: 既存の選択肢のみ
    diveType: yup
        .string()
        .transform((v) => (v === '' || v == null ? null : v))
        .nullable()
        .test(
            'valid-dive-type',
            'ダイブタイプの値が不正です',
            (value) => value == null || DIVE_TYPE_VALUE_SET.has(value),
        )
        .default(null),
    location: yup
        .string()
        .trim()
        .max(120, 'ポイント名は120文字以内で入力してください')
        .transform((v) => (v === '' ? null : v))
        .nullable()
        .default(null),
    // バディ名（フリーテキスト・部分一致）での絞り込み（spec 021 FR-022）
    buddyName: yup
        .string()
        .trim()
        .max(100, 'バディ名は100文字以内で入力してください')
        .transform((v) => (v === '' ? null : v))
        .nullable()
        .default(null),
});

export type DiveSearchValues = yup.InferType<typeof diveSearchSchema>;
