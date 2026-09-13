import { notFound } from 'next/navigation';

import { getRegulator, RegulatorForm } from '@/features/regulators';
import { Breadcrumbs } from '@/shared/components/layout/Breadcrumbs';
import { Heading } from '@/shared/components/typography/Heading';
import { generatePageMetadata } from '@/shared/config/metadata';

interface EditEquipmentPageProps {
    params: Promise<{ id: string }>;
}

export const generateMetadata = async ({ params }: EditEquipmentPageProps) => {
    const { id } = await params;
    return generatePageMetadata(
        {
            slug: `/settings/equipment/${id}/edit`,
            title: '機材の編集',
            description: 'レギュレーター機材を編集します',
        },
        { noIndex: true },
    );
};

export default async function EditEquipmentPage({ params }: EditEquipmentPageProps) {
    const { id } = await params;
    const regulator = await getRegulator(id);
    if (!regulator) notFound();

    return (
        <div className="flex flex-1 flex-col">
            <Breadcrumbs
                breadcrumbs={[
                    { name: '機材設定', slug: '/settings/equipment' },
                    { name: `${regulator.brand} ${regulator.model}` },
                    { name: '編集' },
                ]}
            />
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
                <Heading level={1}>機材の編集</Heading>
                <RegulatorForm
                    regulatorId={id}
                    defaultValues={{
                        brand: regulator.brand,
                        model: regulator.model,
                        purchasedOn: regulator.purchasedOn,
                        lastOverhauledOn: regulator.lastOverhauledOn,
                        overhaulIntervalMonths: regulator.overhaulIntervalMonths,
                        overhaulIntervalDives: regulator.overhaulIntervalDives,
                        isPrimary: regulator.isPrimary,
                        notes: regulator.notes,
                    }}
                />
            </div>
        </div>
    );
}
