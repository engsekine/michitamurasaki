import type { NextPlanSummary } from '@/features/plans/types';

interface SplitTodayPlanResult {
    /** 当日（daysUntil = 0）の予定。TOP の FV に詳細カードで表示する。なければ null */
    todayPlan: NextPlanSummary | null;
    /** FV 下の「次のダイビング予定」セクションに表示する予定（todayPlan を除いた残り） */
    upcomingPlans: NextPlanSummary[];
}

/**
 * 次の予定一覧から当日の予定を 1 件切り出す（TOP の FV / FV 下セクションの振り分け用）。
 * 一覧は plannedOn 昇順ソート済みの前提のため、当日の予定は先頭にのみ現れる。
 * 当日の予定が複数ある場合、2 件目以降は upcomingPlans に残して表示から落とさない。
 */
export const splitTodayPlan = (plans: NextPlanSummary[]): SplitTodayPlanResult => {
    const [firstPlan] = plans;
    if (firstPlan?.daysUntil !== 0) return { todayPlan: null, upcomingPlans: plans };

    return {
        todayPlan: firstPlan,
        upcomingPlans: plans.filter((plan) => plan.id !== firstPlan.id),
    };
};
