import Link from 'next/link';
import { DeleteRegulatorButton, listRegulators, RegulatorList } from '@/features/regulators';
import { Breadcrumbs } from '@/shared/components/layout/Breadcrumbs';
import { Heading } from '@/shared/components/typography/Heading';
import { buttonVariants } from '@/shared/components/ui/Button';
import { generatePageMetadata } from '@/shared/config/metadata';

export const metadata = generatePageMetadata(
    {
        slug: '/settings/equipment',
        title: '機材設定',
        description: 'レギュレーター機材の登録・管理',
    },
    { noIndex: true },
);

export default async function EquipmentPage() {
    const regulators = await listRegulators();

    return (
        <div className="flex flex-1 flex-col">
            <Breadcrumbs breadcrumbs={[{ name: '機材設定' }]} />
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
                <div className="flex items-center justify-between">
                    <Heading level={1}>機材設定</Heading>
                    <Link href="/settings/equipment/new" className={buttonVariants({ variant: 'default' })}>
                        機材を登録
                    </Link>
                </div>
                <RegulatorList
                    regulators={regulators}
                    renderActions={(regulator) => (
                        <div className="flex items-center gap-2">
                            <Link
                                href={`/settings/equipment/${regulator.id}/edit`}
                                className={buttonVariants({ variant: 'outline', size: 'sm' })}
                            >
                                編集
                            </Link>
                            <DeleteRegulatorButton
                                regulatorId={regulator.id}
                                name={`${regulator.brand} ${regulator.model}`}
                            />
                        </div>
                    )}
                />
            </div>
        </div>
    );
}
