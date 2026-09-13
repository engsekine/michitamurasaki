import type { DiveFormValues } from '@/features/dives/schemas/dive.schema';

/**
 * 予定→ログ移動でプレフィルに必要な予定の最小形（024）。
 * plans feature の `Plan` 型に構造的に一致する（ランタイム結合を避けるため型は再宣言）。
 */
interface PlanDefaultsInput {
    plannedOn: string;
    location: string;
    notes: string | null;
    /** 予定に紐付けたショップ（033）。未紐付けは null / 未指定 */
    diveShopId?: string | null;
}

/**
 * ダイビング予定を、新規ログ作成フォームの初期値へ変換する（024 FR-004 / FR-005）。
 *
 * - 予定日 → 潜水日（移動は当日以前に限定されるため潜水日制約を満たす）
 * - ポイント名 → ポイント名（自由入力。diveSiteId は設定せず location と排他の制約を満たす）
 * - メモ → メモ（location 120・notes 2000 の上限は予定・ログで一致するため切り詰め不要 = FR-008 は design-covered）
 *
 * 予定に紐付けたショップはログの初期値へ引き継ぐ（033 / FR-008）。
 * 必須の最大水深・潜水時間は含めず、ユーザーが入力する（FR-006）。
 * ダイブ番号はページ側の自動採番とマージするため、ここでは扱わない（FR-013）。
 */
export const planToDiveDefaults = (plan: PlanDefaultsInput): Partial<DiveFormValues> => ({
    diveDate: plan.plannedOn,
    location: plan.location,
    notes: plan.notes,
    diveShopId: plan.diveShopId ?? null,
});
