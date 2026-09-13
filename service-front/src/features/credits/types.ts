/** ログ枠（クレジット）関連の型定義（026-log-monetization / data-model.md と同期） */

/** log_credit_ledger.kind の種別 */
export type CreditLedgerKind = 'initial_grant' | 'daily_bonus' | 'purchase' | 'consumption' | 'refund_adjustment';

/** log_credit_purchases.status の決済状態 */
export type PurchaseStatus = 'pending' | 'completed' | 'failed' | 'refunded';

/** 購入履歴の 1 件（表示用。quantity / amountJpy は購入時点のスナップショット） */
export interface Purchase {
    id: string;
    /** 付与されたログ枠数 */
    quantity: number;
    /** 支払額（円） */
    amountJpy: number;
    status: PurchaseStatus;
    /** 購入日時（ISO 8601） */
    purchasedAt: string;
}
