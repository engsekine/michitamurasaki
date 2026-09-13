import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getProfile, ProfileEditForm } from '@/features/account';
import { Breadcrumbs } from '@/shared/components/layout/Breadcrumbs';
import { Heading } from '@/shared/components/typography/Heading';
import { generatePageMetadata } from '@/shared/config/metadata';

export const metadata = generatePageMetadata(
    {
        slug: '/settings/profile',
        title: '会員情報の編集',
        description: '会員情報を編集します',
    },
    { noIndex: true },
);

export default async function ProfileEditPage() {
    const profile = await getProfile();
    if (!profile) notFound();

    return (
        <div className="flex flex-1 flex-col">
            <Breadcrumbs breadcrumbs={[{ name: '会員情報の編集' }]} />
            <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-12">
                <Heading level={1}>会員情報の編集</Heading>
                <ProfileEditForm
                    email={profile.email}
                    defaultValues={{
                        lastName: profile.lastName,
                        firstName: profile.firstName,
                        lastNameRomaji: profile.lastNameRomaji,
                        firstNameRomaji: profile.firstNameRomaji,
                        nickname: profile.nickname,
                        handle: profile.handle,
                        birthOn: profile.birthOn,
                        gender: profile.gender,
                        heightCm: profile.heightCm,
                        weightKg: profile.weightKg,
                        diverType: profile.diverType,
                        diverNumber: profile.diverNumber,
                        emailOptIn: profile.emailOptIn,
                    }}
                />
                <section
                    aria-labelledby="related-settings-heading"
                    className="flex flex-col gap-2 border-border border-t pt-6"
                >
                    <h2 id="related-settings-heading" className="font-semibold text-lg">
                        その他の設定
                    </h2>
                    <Link href="/settings/certifications" className="text-primary text-sm underline">
                        保有資格を管理する
                    </Link>
                </section>
            </div>
        </div>
    );
}
