import { PlanForm } from '@/features/plans';
import { getShopOptions } from '@/features/shops';
import { Breadcrumbs } from '@/shared/components/layout/Breadcrumbs';
import { Heading } from '@/shared/components/typography/Heading';
import { generatePageMetadata } from '@/shared/config/metadata';

export const metadata = generatePageMetadata(
    {
        slug: '/plans/new',
        title: 'ダイビング予定の作成',
        description: '新しいダイビング予定を作成します',
    },
    { noIndex: true },
);

export default async function NewPlanPage() {
    // ショップ選択肢は page 合成で注入する（feature 間 import 禁止 / 033 research.md Decision 5）
    const shopOptions = await getShopOptions();

    return (
        <div className="flex flex-1 flex-col">
            <Breadcrumbs breadcrumbs={[{ name: 'ダイビング予定', slug: '/plans' }, { name: '作成' }]} />
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
                <Heading level={1}>ダイビング予定の作成</Heading>
                <PlanForm shopOptions={shopOptions} />
            </div>
        </div>
    );
}
