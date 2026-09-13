import { RegulatorForm } from '@/features/regulators';
import { Breadcrumbs } from '@/shared/components/layout/Breadcrumbs';
import { Heading } from '@/shared/components/typography/Heading';
import { generatePageMetadata } from '@/shared/config/metadata';

export const metadata = generatePageMetadata(
    {
        slug: '/settings/equipment/new',
        title: '機材の登録',
        description: 'レギュレーター機材を新規登録します',
    },
    { noIndex: true },
);

export default function NewEquipmentPage() {
    return (
        <div className="flex flex-1 flex-col">
            <Breadcrumbs breadcrumbs={[{ name: '機材設定', slug: '/settings/equipment' }, { name: '登録' }]} />
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
                <Heading level={1}>機材の登録</Heading>
                <RegulatorForm />
            </div>
        </div>
    );
}
