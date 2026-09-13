import { calcOverhaulStatus } from '@/features/dashboard/lib/overhaul';

/**
 * ダイビング予定が「今日リマインドすべき」か（025 / FR-009）。
 * - 予定日が JST の今日であること
 * - 過去日で登録された予定（登録日 > 予定日）は対象外
 * 登録日時（timestamptz）は JST の暦日に変換して比較する。
 */
export const isPlanDueToday = (params: { plannedOn: string; createdAt: string; today: string }): boolean => {
    const { plannedOn, createdAt, today } = params;
    if (plannedOn !== today) return false;

    const createdOnJst = new Date(createdAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
    return createdOnJst <= plannedOn;
};

/**
 * レギュレーターの OH 期限が到来していれば期限日（YYYY-MM-DD）を、未到来なら null を返す（025 / FR-010）。
 * 期限日の計算（月加算・存在しない日の月末丸め）は dashboard の calcOverhaulStatus に委譲し、
 * 二重実装しない。日付基準のみで判定する（本数基準の期限切れは通知対象外 / spec FR-010）。
 * 返した期限日は通知の dedup_key として「1 回だけ」を保証する。
 */
export const getOverhaulDueDate = (params: {
    lastOverhauledOn: string;
    intervalMonths: number;
    intervalDives: number;
    today: string;
}): string | null => {
    const status = calcOverhaulStatus({
        lastOverhauledOn: params.lastOverhauledOn,
        intervalMonths: params.intervalMonths,
        intervalDives: params.intervalDives,
        // 本数基準を無効化して日付基準のみで判定する
        divesSinceLastOverhaul: 0,
        today: params.today,
    });
    return status.remainingDays <= 0 ? status.nextOverhaulDate : null;
};
