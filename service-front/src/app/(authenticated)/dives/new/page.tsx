import { CreditBalanceBadge } from '@/features/credits/components/server/CreditBalanceBadge';
import { getCreditBalance } from '@/features/credits/server/queries';
import { listDiveSites, siteLabel } from '@/features/dive-sites';
import { DiveForm, type DiveFormValues, getLatestDiveNumber, planToDiveDefaults } from '@/features/dives';
import { canMovePlanToLog, getPlan } from '@/features/plans';
import { getShopOptions } from '@/features/shops';
import { Breadcrumbs } from '@/shared/components/layout/Breadcrumbs';
import { Heading } from '@/shared/components/typography/Heading';
import { generatePageMetadata } from '@/shared/config/metadata';
import { todayInJst } from '@/shared/lib/date';

export const metadata = generatePageMetadata(
    {
        slug: '/dives/new',
        title: '新規ダイビングログ',
        description: '新しいダイビングログを記録します',
    },
    { noIndex: true },
);

interface NewDivePageProps {
    searchParams: Promise<{ fromPlanId?: string }>;
}

export default async function NewDivePage({ searchParams }: NewDivePageProps) {
    const { fromPlanId } = await searchParams;
    const [latestDiveNumber, sites, creditBalance, shopOptions] = await Promise.all([
        getLatestDiveNumber(),
        listDiveSites(),
        getCreditBalance(),
        // ショップ選択肢は page 合成で注入する（feature 間 import 禁止 / 033 research.md Decision 5）
        getShopOptions(),
    ]);
    const nextDiveNumber = (latestDiveNumber ?? 0) + 1;
    const siteOptions = sites.map((site) => ({ value: site.id, label: siteLabel(site) }));

    // 予定→ログ移動（024）: 当日以前の自分の予定に限り、内容を初期値として引き継ぐ。
    // 予定が無い / 未来日のときは fromPlanId を無視して通常の新規作成フォームを表示する（graceful）。
    let planDefaults: Partial<DiveFormValues> = {};
    let movingPlanId: string | undefined;
    if (fromPlanId) {
        const plan = await getPlan(fromPlanId);
        if (plan && canMovePlanToLog(plan.plannedOn, todayInJst())) {
            planDefaults = planToDiveDefaults(plan);
            movingPlanId = plan.id;
        }
    }

    return (
        <div className="flex flex-1 flex-col">
            <Breadcrumbs breadcrumbs={[{ name: 'ダイビングログ', slug: '/dives' }, { name: '新規作成' }]} />
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
                <div className="flex items-center justify-between">
                    <Heading level={1}>新規ダイビングログ</Heading>
                    <CreditBalanceBadge />
                </div>
                <DiveForm
                    defaultValues={{ diveNumber: nextDiveNumber, ...planDefaults }}
                    siteOptions={siteOptions}
                    creditBalance={creditBalance}
                    shopOptions={shopOptions}
                    {...(movingPlanId ? { fromPlanId: movingPlanId } : {})}
                />
            </div>
        </div>
    );
}
