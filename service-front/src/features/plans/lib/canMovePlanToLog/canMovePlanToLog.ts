import { daysUntil } from '@/shared/lib/date';

/**
 * 予定をダイビングログへ「移動」できるかを判定する（024 FR-002）。
 *
 * ログの潜水日は未来日を受け付けないため、移動できるのは予定日が当日以前
 * （今日 = 0 / 過去 < 0）の予定のみ。未来（> 0）は導線を出さない。
 *
 * @param plannedOn 予定日（YYYY-MM-DD）
 * @param today JST の今日（YYYY-MM-DD）。呼び出し側で todayInJst() を渡す
 */
export const canMovePlanToLog = (plannedOn: string, today: string): boolean => daysUntil(plannedOn, today) <= 0;
