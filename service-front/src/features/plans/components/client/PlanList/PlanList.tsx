'use client';

import Link from 'next/link';
import { canMovePlanToLog } from '@/features/plans/lib/canMovePlanToLog';
import { daysUntil } from '@/features/plans/lib/days-until';
import type { Plan } from '@/features/plans/types';
import { Heading } from '@/shared/components/typography/Heading';
import { buttonVariants } from '@/shared/components/ui/Button';
import { formatJstDate } from '@/shared/lib/date';
import { getTidePhase, TIDE_PHASE_LABELS } from '@/shared/lib/tide';

interface PlanListProps {
    plans: Plan[];
    /** JST の今日（YYYY-MM-DD）。サーバー側で todayInJst() を渡す */
    today: string;
}

/** 残り日数の表示文言（0 = 今日、正 = あと N 日） */
const formatDaysUntil = (days: number): string => (days === 0 ? '今日' : `あと${days}日`);

interface PlanCardProps {
    plan: Plan;
    /** 残り日数の表示文言。終了済みの予定は null（残り日数の代わりにバッジを表示する） */
    daysLabel: string | null;
    /** JST の今日（YYYY-MM-DD）。移動導線の出し分け判定に使う */
    today: string;
}

export const PlanList = ({ plans, today }: PlanListProps) => {
    // FR-005: 予定日が今日以降を「これから」、過去を「終了済み」に区分して表示する
    const upcomingPlans = plans.filter((plan) => daysUntil(plan.plannedOn, today) >= 0);
    const finishedPlans = plans.filter((plan) => daysUntil(plan.plannedOn, today) < 0);

    // FR-001: 予定 0 件時は作成導線（CTA）を表示する
    if (plans.length === 0) {
        return (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-border border-dashed bg-background p-12 text-center">
                <p className="text-muted-foreground">予定がまだありません</p>
                <Link href="/plans/new" className={buttonVariants({ variant: 'default' })}>
                    次のダイビングを計画しよう
                </Link>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {upcomingPlans.length > 0 && (
                <section aria-labelledby="upcoming-plans-heading" className="flex flex-col gap-3">
                    <Heading level={2} id="upcoming-plans-heading">
                        これからの予定
                    </Heading>
                    <ul className="flex flex-col gap-3">
                        {upcomingPlans.map((plan) => (
                            <li key={plan.id}>
                                <PlanCard
                                    plan={plan}
                                    daysLabel={formatDaysUntil(daysUntil(plan.plannedOn, today))}
                                    today={today}
                                />
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {finishedPlans.length > 0 && (
                <section aria-labelledby="finished-plans-heading" className="flex flex-col gap-3">
                    <Heading level={2} id="finished-plans-heading">
                        終了済み
                    </Heading>
                    <ul className="flex flex-col gap-3">
                        {finishedPlans.map((plan) => (
                            <li key={plan.id}>
                                <PlanCard plan={plan} daysLabel={null} today={today} />
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
};

/**
 * 予定カード。h3 はセクション見出し（h2）配下で使われる。
 * 注: markuplint の heading-levels はファイル内の出現順で判定するため、
 * h2 を含む PlanList より後に定義する。
 */
const PlanCard = ({ plan, daysLabel, today }: PlanCardProps) => {
    const tidePhase = getTidePhase(plan.plannedOn);
    // 当日以前の予定のみ「ログに記録する」を表示（未来日は非表示 / 024 FR-001,002）
    const canMove = canMovePlanToLog(plan.plannedOn, today);

    return (
        <article className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4 transition-colors hover:bg-muted/50">
            <Link href={`/plans/${plan.id}`} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-sm">
                            <span className="sr-only">予定日: </span>
                            {formatJstDate(plan.plannedOn)}
                        </span>
                        {/* バッジは text-muted-foreground だと bg-muted 上でコントラスト AA 未達のため text-foreground を使う */}
                        {tidePhase !== null && (
                            <span className="rounded-md bg-muted px-2 py-0.5 text-foreground text-xs">
                                <span className="sr-only">潮回り: </span>
                                {TIDE_PHASE_LABELS[tidePhase]}
                            </span>
                        )}
                    </div>
                    {/* バッジは text-muted-foreground だと bg-muted 上でコントラスト 4.34:1 と AA 未達のため text-foreground を使う */}
                    {daysLabel === null ? (
                        <span className="inline-block rounded-md bg-muted px-2 py-0.5 text-foreground text-xs">
                            終了済み
                        </span>
                    ) : (
                        <span className="font-medium text-[#1a73cc] text-sm">{daysLabel}</span>
                    )}
                </div>
                <Heading level={3} className="text-foreground">
                    {plan.location}
                </Heading>
            </Link>
            {canMove && (
                <div className="flex">
                    <Link
                        href={`/dives/new?fromPlanId=${plan.id}`}
                        className={buttonVariants({ variant: 'outline', size: 'sm' })}
                        aria-label={`${plan.location}の予定をログに記録する`}
                    >
                        ログに記録する
                    </Link>
                </div>
            )}
        </article>
    );
};
