import { CertificationForm, toDiveSelectOptions } from '@/features/certifications';
import { listDiveOptions } from '@/features/dives';
import { Breadcrumbs } from '@/shared/components/layout/Breadcrumbs';
import { Heading } from '@/shared/components/typography/Heading';
import { generatePageMetadata } from '@/shared/config/metadata';

export const metadata = generatePageMetadata(
    {
        slug: '/settings/certifications/new',
        title: '資格の登録',
        description: 'ダイビングライセンス資格を新規登録します',
    },
    { noIndex: true },
);

export default async function NewCertificationPage() {
    const diveOptions = await listDiveOptions();

    return (
        <div className="flex flex-1 flex-col">
            <Breadcrumbs breadcrumbs={[{ name: '保有資格', slug: '/settings/certifications' }, { name: '登録' }]} />
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
                <Heading level={1}>資格の登録</Heading>
                <CertificationForm diveOptions={toDiveSelectOptions(diveOptions)} />
            </div>
        </div>
    );
}
