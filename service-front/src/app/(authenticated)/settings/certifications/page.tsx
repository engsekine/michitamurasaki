import Link from 'next/link';
import {
    AGENCY_LABELS,
    CertificationList,
    DeleteCertificationButton,
    getCertifications,
} from '@/features/certifications';
import { Breadcrumbs } from '@/shared/components/layout/Breadcrumbs';
import { Heading } from '@/shared/components/typography/Heading';
import { buttonVariants } from '@/shared/components/ui/Button';
import { generatePageMetadata } from '@/shared/config/metadata';
import { todayInJst } from '@/shared/lib/date';

export const metadata = generatePageMetadata(
    {
        slug: '/settings/certifications',
        title: '保有資格',
        description: 'ダイビングライセンス資格の登録・管理',
    },
    { noIndex: true },
);

export default async function CertificationsPage() {
    const certifications = await getCertifications();

    return (
        <div className="flex flex-1 flex-col">
            <Breadcrumbs breadcrumbs={[{ name: '保有資格' }]} />
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
                <div className="flex items-center justify-between">
                    <Heading level={1}>保有資格</Heading>
                    <Link href="/settings/certifications/new" className={buttonVariants({ variant: 'default' })}>
                        資格を登録
                    </Link>
                </div>
                <CertificationList
                    certifications={certifications}
                    today={todayInJst()}
                    renderActions={(certification) => (
                        <div className="flex items-center gap-2">
                            <Link
                                href={`/settings/certifications/${certification.id}/edit`}
                                className={buttonVariants({ variant: 'outline', size: 'sm' })}
                            >
                                編集
                            </Link>
                            <DeleteCertificationButton
                                certificationId={certification.id}
                                name={`${AGENCY_LABELS[certification.agency]} ${certification.rank}`}
                            />
                        </div>
                    )}
                />
            </div>
        </div>
    );
}
