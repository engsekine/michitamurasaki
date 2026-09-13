import { RENTAL_ITEM_KEYS } from '../../constants';
import type {
    ApplicationSheetRow,
    ContactLensTypeValue,
    RentalItemKey,
    SheetFormValues,
    SheetGenderValue,
    YesNoValue,
} from '../../types';
import { yearMonthToDisplay } from '../yearMonth';

/** boolean | null（DB 値）→ 有無ラジオの値。null は未選択 */
const toYesNoValue = (value: boolean | null): YesNoValue => {
    if (value === true) return 'yes';
    if (value === false) return 'no';
    return '';
};

/** 数値 | null → フォームの文字列値 */
const toNumberText = (value: number | null): string => (value === null ? '' : String(value));

/** jsonb の配列から既知のレンタル品目キーだけを取り出す */
const toRentalItemKeys = (value: ApplicationSheetRow['rental_items']): RentalItemKey[] => {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is RentalItemKey => RENTAL_ITEM_KEYS.includes(item as RentalItemKey));
};

/**
 * 保存済みシートの DB 行をフォーム値（スナップショット全体）へ変換する純関数。
 * 数値は入力欄の文字列へ、nullable boolean は有無ラジオの値へ揃える。
 */
export const sheetToFormValues = (row: ApplicationSheetRow): SheetFormValues => ({
    fullName: row.full_name,
    age: toNumberText(row.age),
    birthOn: row.birth_on ?? '',
    gender: (row.gender ?? '') as SheetGenderValue,
    phone: row.phone,
    emergencyContactRelation: row.emergency_contact_relation,
    emergencyContactPhone: row.emergency_contact_phone,
    nearestStation: row.nearest_station,
    licenseRank: row.license_rank,
    diveCount: toNumberText(row.dive_count),
    lastDiveYearMonth: yearMonthToDisplay(row.last_dive_year_month),
    hasDrySuitExperience: toYesNoValue(row.has_dry_suit_experience),
    drySuitDiveCount: toNumberText(row.dry_suit_dive_count),
    hasRental: toYesNoValue(row.has_rental),
    rentalItems: toRentalItemKeys(row.rental_items),
    omitRentalBlock: row.omit_rental_block,
    heightCm: toNumberText(row.height_cm),
    weightKg: toNumberText(row.weight_kg),
    footSizeCm: toNumberText(row.foot_size_cm),
    hasContactLens: toYesNoValue(row.has_contact_lens),
    contactLensType: (row.contact_lens_type ?? '') as ContactLensTypeValue,
    needsPrescriptionMask: toYesNoValue(row.needs_prescription_mask),
    diveShopId: row.dive_shop_id ?? '',
});
