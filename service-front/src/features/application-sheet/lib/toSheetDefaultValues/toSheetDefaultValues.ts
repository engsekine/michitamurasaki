import type { SheetFormValues, SheetPrefill, YesNoValue } from '../../types';
import { yearMonthToDisplay } from '../yearMonth';

/** boolean | null（保存値）→ 有無ラジオの値。null は未選択 */
const toYesNoValue = (value: boolean | null): YesNoValue => {
    if (value === true) return 'yes';
    if (value === false) return 'no';
    return '';
};

/** null / 空文字を取り除き、値のあるキーだけ残す */
const compact = (entries: Partial<SheetFormValues>): Partial<SheetFormValues> =>
    Object.fromEntries(
        Object.entries(entries).filter(([, value]) => value !== null && value !== undefined && value !== ''),
    ) as Partial<SheetFormValues>;

/**
 * 自動入力データ（FR-007）を新規シートのフォーム初期値に変換する。
 * 未登録（null）の項目はキーごと省き、フォーム側のデフォルト（空欄）に任せる（FR-009）。
 * 保存済みシートを開く場合は sheetToFormValues でスナップショットをそのまま復元する。
 */
export const toSheetDefaultValues = (prefill: SheetPrefill | null): Partial<SheetFormValues> => {
    if (!prefill) return {};

    return compact({
        fullName: prefill.fullName ?? '',
        birthOn: prefill.birthOn ?? '',
        age: prefill.age !== null ? String(prefill.age) : '',
        gender: prefill.gender ?? '',
        heightCm: prefill.heightCm !== null ? String(prefill.heightCm) : '',
        weightKg: prefill.weightKg !== null ? String(prefill.weightKg) : '',
        licenseRank: prefill.licenseRank ?? '',
        diveCount: prefill.diveCount !== null ? String(prefill.diveCount) : '',
        lastDiveYearMonth: yearMonthToDisplay(prefill.lastDiveYearMonth),
        phone: prefill.phone ?? '',
        emergencyContactRelation: prefill.emergencyContactRelation ?? '',
        emergencyContactPhone: prefill.emergencyContactPhone ?? '',
        nearestStation: prefill.nearestStation ?? '',
        hasDrySuitExperience: toYesNoValue(prefill.hasDrySuitExperience),
        drySuitDiveCount: prefill.drySuitDiveCount !== null ? String(prefill.drySuitDiveCount) : '',
    });
};
