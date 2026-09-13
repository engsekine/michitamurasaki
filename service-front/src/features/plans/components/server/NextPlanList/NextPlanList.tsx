import Link from 'next/link';
import type { NextPlanSummary } from '@/features/plans/types';
import { formatJstDateWithWeekday } from '@/shared/lib/date';

/** 一覧行に必要な最小限の予定情報（持ち物は扱わない） */
type NextPlanListItem = Pick<NextPlanSummary, 'id' | 'plannedOn' | 'location' | 'daysUntil'>;

interface NextPlanListProps {
    plans: NextPlanListItem[];
}

/** 残り日数の表示。色だけに依存せずテキストで伝える（表記は NextPlanCard と統一: 今日 / あと N 日） */
const formatDaysUntil = (daysUntil: number): string => {
    if (daysUntil === 0) return '今日';
    return `あと ${daysUntil} 日`;
};

/**
 * TOP の FV 下に置く次の予定の簡素な一覧（持ち物の準備は表示しない）。
 * 行の構成は FV のストリップと同じ（予定日（曜日付き）— 行き先 / 残り日数バッジ）で、
 * 各行は予定詳細へのリンクにする。表示件数の上限（最大 5 件）は呼び出し側で制御する。
 */
export const NextPlanList = ({ plans }: NextPlanListProps) => {
    if (plans.length === 0) {
        return (
            <p className="rounded-xl border border-border border-dashed bg-background p-4 text-muted-foreground">
                次の予定はまだありません。予定を作成して次のダイビングに備えましょう
            </p>
        );
    }

    return (
        <ul className="flex flex-col gap-3">
            {plans.map((plan) => (
                <li key={plan.id}>
                    <Link
                        href={`/plans/${plan.id}`}
                        className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background p-4 transition-colors hover:bg-muted/50"
                    >
                        <span className="font-semibold text-foreground text-lg">
                            <span className="sr-only">予定日: </span>
                            {formatJstDateWithWeekday(plan.plannedOn)}
                            <span aria-hidden="true"> — </span>
                            <span className="sr-only">行き先: </span>
                            {plan.location}
                        </span>
                        <span className="shrink-0 rounded-full bg-[#1a73cc] px-3 py-1 font-semibold text-sm text-white">
                            <span className="sr-only">残り日数: </span>
                            {formatDaysUntil(plan.daysUntil)}
                        </span>
                    </Link>
                </li>
            ))}
        </ul>
    );
};
