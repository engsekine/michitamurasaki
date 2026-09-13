import { notFound } from 'next/navigation';

import { AGENCY_LABELS, CertificationForm, getCertificationById, toDiveSelectOptions } from '@/features/certifications';
import { listDiveOptions } from '@/features/dives';
import { Breadcrumbs } from '@/shared/components/layout/Breadcrumbs';
import { Heading } from '@/shared/components/typography/Heading';
import { generatePageMetadata } from '@/shared/config/metadata';

interface EditCertificationPageProps {
    params: Promise<{ id: string }>;
}

export const generateMetadata = async ({ params }: EditCertificationPageProps) => {
    const { id } = await params;
    return generatePageMetadata(
        {
            slug: `/settings/certifications/${id}/edit`,
            title: '資格の編集',
            description: 'ダイビングライセンス資格を編集します',
        },
        { noIndex: true },
    );
};

export default async function EditCertificationPage({ params }: EditCertificationPageProps) {
    const { id } = await params;
    const [certification, diveOptions] = await Promise.all([getCertificationById(id), listDiveOptions()]);
    if (!certification) notFound();

    return (
        <div className="flex flex-1 flex-col">
            <Breadcrumbs
                breadcrumbs={[
                    { name: '保有資格', slug: '/settings/certifications' },
                    { name: `${AGENCY_LABELS[certification.agency]} ${certification.rank}` },
                    { name: '編集' },
                ]}
            />
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
                <Heading level={1}>資格の編集</Heading>
                <CertificationForm
                    certificationId={id}
                    defaultValues={{
                        agency: certification.agency,
                        rank: certification.rank,
                        acquiredOn: certification.acquiredOn,
                        diverNumber: certification.diverNumber ?? '',
                        instructorNumber: certification.instructorNumber ?? '',
                        trainedBy: certification.trainedBy ?? '',
                        acquiredLocation: certification.acquiredLocation ?? '',
                        specialtyTags: certification.tags.join(', '),
                        diveId: certification.dive?.id ?? '',
                    }}
                    diveOptions={toDiveSelectOptions(diveOptions)}
                />
            </div>
        </div>
    );
}
