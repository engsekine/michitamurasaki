import Link from 'next/link';
import { daysUntil, listNextPlansWithProgress, listPlans, NextPlanCardView, PlanList } from '@/features/plans';
import { Breadcrumbs } from '@/shared/components/layout/Breadcrumbs';
import { Heading } from '@/shared/components/typography/Heading';
import { buttonVariants } from '@/shared/components/ui/Button';
import { generatePageMetadata } from '@/shared/config/metadata';
import { todayInJst } from '@/shared/lib/date';

export const metadata = generatePageMetadata(
    {
        slug: '/plans',
        title: 'ダイビング予定',
        description: 'あなたのダイビング予定一覧',
    },
    { noIndex: true },
);

export default async function PlansPage() {
    const today = todayInJst();
    // 「これからの予定」は TOP の FV 直下と同じ NextPlanCardView（持ち物進捗込み）で表示するため
    // 持ち物込みの一覧を取得する。「終了済み」と 0 件時の作成導線は従来どおり PlanList に委ねる。
    const [nextPlans, allPlans] = await Promise.all([listNextPlansWithProgress(), listPlans()]);
    const finishedPlans = allPlans.filter((plan) => daysUntil(plan.plannedOn, today) < 0);

    return (
        <div className="flex flex-1 flex-col">
            <Breadcrumbs breadcrumbs={[{ name: 'ダイビング予定' }]} />
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
                <div className="flex items-center justify-between">
                    <Heading level={1}>ダイビング予定</Heading>
                    <Link href="/plans/new" className={buttonVariants({ variant: 'default' })}>
                        予定を作成
                    </Link>
                </div>

                {allPlans.length === 0 ? (
                    // 予定 0 件時の作成導線（FR-001）は PlanList の空状態表示に委ねる
                    <PlanList plans={allPlans} today={today} />
                ) : (
                    <div className="flex flex-col gap-6">
                        {nextPlans.length > 0 && (
                            <section aria-labelledby="upcoming-plans-heading" className="flex flex-col gap-3">
                                <Heading level={2} id="upcoming-plans-heading">
                                    これからの予定
                                </Heading>
                                <ul className="flex flex-col gap-3">
                                    {nextPlans.map((plan) => (
                                        <li key={plan.id}>
                                            <NextPlanCardView summary={plan} />
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}
                        {/* 終了済みのみを渡す（PlanList 内の「これからの予定」節は空になり非表示） */}
                        {finishedPlans.length > 0 && <PlanList plans={finishedPlans} today={today} />}
                    </div>
                )}
            </div>
        </div>
    );
}
