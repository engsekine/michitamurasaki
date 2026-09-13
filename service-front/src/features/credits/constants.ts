/**
 * ログ枠（クレジット）の定数（026-log-monetization）。
 * 金額・数量はクライアント入力を信用せず、必ずこの定数を唯一の情報源とする。
 */

/** 買い切りログパック 1 種の定義 */
export interface LogCreditPack {
    /** パック識別子。Checkout Session の metadata.pack_id に載せて webhook で判別する */
    id: 'trial' | 'standard' | 'bulk';
    /** 付与するログ枠数 */
    quantity: number;
    /** 税込価格（円） */
    amountJpy: number;
    /** Stripe Checkout / 購入 UI に表示する商品名 */
    displayName: string;
    /** お試しパック（48 円/ログ）比の割引率表示。基準となるお試しパック自身は null */
    discountLabel: string | null;
    /** 購入 UI で強調表示するおすすめパックか */
    isRecommended: boolean;
}

/** 買い切りログパックの定義（単価: 48 円 / 40 円 / 30 円 per ログ） */
export const LOG_CREDIT_PACKS = [
    {
        id: 'trial',
        quantity: 10,
        amountJpy: 480,
        displayName: 'お試しパック（10 枠）',
        discountLabel: null,
        isRecommended: false,
    },
    {
        id: 'standard',
        quantity: 30,
        amountJpy: 1200,
        displayName: 'おすすめパック（30 枠）',
        discountLabel: '約17%おトク',
        isRecommended: true,
    },
    {
        id: 'bulk',
        quantity: 100,
        amountJpy: 3000,
        displayName: 'たっぷりパック（100 枠）',
        discountLabel: '約37%おトク',
        isRecommended: false,
    },
] as const satisfies readonly LogCreditPack[];

export type LogCreditPackId = LogCreditPack['id'];

/** packId からパック定義を引く（クライアント入力の検証を兼ねるため undefined を返しうる） */
export const findLogCreditPack = (packId: string): LogCreditPack | undefined =>
    LOG_CREDIT_PACKS.find((pack) => pack.id === packId);

/** デイリーボーナスの 1 日あたり付与枠数 */
export const DAILY_BONUS_AMOUNT = 1;

/** 新規登録・機能導入時の初期無料枠（FR-008。DB マイグレーションの値と同期） */
export const INITIAL_GRANT_AMOUNT = 10;

/**
 * 残枠不足で dives の INSERT が拒否されたときのエラー DETAIL（consume_log_credit トリガーと同期）。
 * 独自 errcode は PostgREST が 500 に握りつぶすため、P0001 + DETAIL で判別する
 */
export const NO_CREDIT_ERROR_DETAIL = 'no_credit';

/** ActionResult.code に載せる残枠不足の識別子 */
export const NO_CREDIT_ACTION_CODE = 'no_credit';
