import type { Database } from '@repo/supabase';

type DivePlanRow = Database['public']['Tables']['dive_plans']['Row'];
type PackingItemRow = Database['public']['Tables']['plan_packing_items']['Row'];

/** 予定・ログ詳細に表示する紐付けショップの要約（033。feature 間 import を避けるため独自定義） */
export interface PlanShopSummary {
    id: string;
    name: string;
}

/** ダイビング予定 */
export interface Plan {
    id: string;
    plannedOn: string;
    location: string;
    notes: string | null;
    /** 紐付けたショップ id（033）。未紐付けは null */
    diveShopId: string | null;
    createdAt: string;
    updatedAt: string;
}

/** 持ち物項目 */
export interface PackingItem {
    id: string;
    name: string;
    isChecked: boolean;
    /** 忘れ物確認（2 周目チェック）の確認状態（037）。準備チェック isChecked とは独立 */
    isConfirmed: boolean;
    position: number;
}

/** 予定詳細（持ち物込み） */
export interface PlanWithPacking extends Plan {
    packingItems: PackingItem[];
    /** 持ち物準備の完了日時（037）。null = 未完了。値あり = 完了中（忘れ物確認リストを表示） */
    packingCompletedAt: string | null;
    /** 紐付けたショップの要約（033）。未紐付けは null。本人向け詳細でのみ使用する */
    shop: PlanShopSummary | null;
}

/** TOP「次の予定」カード用サマリー */
export interface NextPlanSummary {
    id: string;
    plannedOn: string;
    location: string;
    /** 予定メモ。未入力は null */
    notes: string | null;
    /** 今日 = 0、未来 = 正の値 */
    daysUntil: number;
    /** 持ち物（表示順）。カード上でチェック操作するため全件持つ */
    packingItems: PackingItem[];
    /** 持ち物準備の完了日時（037）。null = 未完了。値あり = 完了中（忘れ物確認リストを表示） */
    packingCompletedAt: string | null;
}

/** DB row → Plan 変換 */
export const mapPlan = (row: DivePlanRow): Plan => ({
    id: row.id,
    plannedOn: row.planned_on,
    location: row.location,
    notes: row.notes,
    diveShopId: row.dive_shop_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

/** DB row → PackingItem 変換 */
export const mapPackingItem = (row: PackingItemRow): PackingItem => ({
    id: row.id,
    name: row.name,
    isChecked: row.is_checked,
    isConfirmed: row.is_confirmed,
    position: row.position,
});
