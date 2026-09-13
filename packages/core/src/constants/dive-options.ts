/**
 * ダイブログ入力の選択肢定数（Web / モバイル共有）。
 * service-front の features/dives/constants.ts から移設（029 / FR-008）。
 */

/** dive_type の選択肢 */
export const DIVE_TYPE_OPTIONS = [
    { value: 'boat', label: 'ボート' },
    { value: 'beach', label: 'ビーチ' },
    { value: 'drift', label: 'ドリフト' },
    { value: 'night', label: 'ナイト' },
    { value: 'deep', label: 'ディープ' },
    { value: 'wreck', label: 'レック' },
    { value: 'cave', label: 'ケーブ' },
    { value: 'training', label: '講習' },
    { value: 'other', label: 'その他' },
] as const;

/** gas_type の選択肢 */
export const GAS_TYPE_OPTIONS = [
    { value: 'air', label: 'Air' },
    { value: 'nitrox', label: 'Nitrox' },
    { value: 'trimix', label: 'Trimix' },
    { value: 'other', label: 'その他' },
] as const;

/** tank_type の選択肢 */
export const TANK_TYPE_OPTIONS = [
    { value: 'steel', label: 'スチール' },
    { value: 'aluminum', label: 'アルミ' },
] as const;

export type TankTypeValue = (typeof TANK_TYPE_OPTIONS)[number]['value'];

/** tank_type の DB 値 → 表示ラベル変換 */
export const TANK_TYPE_LABEL_MAP: Record<TankTypeValue, string> = {
    aluminum: 'アルミ',
    steel: 'スチール',
};
