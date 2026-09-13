import { getMfaStatus, TwoFactorSettings } from '@/features/mfa';
import { Breadcrumbs } from '@/shared/components/layout/Breadcrumbs';
import { Heading } from '@/shared/components/typography/Heading';
import { generatePageMetadata } from '@/shared/config/metadata';

export const metadata = generatePageMetadata(
    {
        slug: '/settings/two-factor',
        title: '2 要素認証',
        description: 'ログイン時の SMS 2 要素認証を設定します',
    },
    { noIndex: true },
);

export default async function TwoFactorSettingsPage() {
    const status = await getMfaStatus();

    return (
        <div className="flex flex-1 flex-col">
            <Breadcrumbs breadcrumbs={[{ name: '2 要素認証' }]} />
            <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-12">
                <Heading level={1}>2 要素認証</Heading>
                <p className="text-muted-foreground text-sm">
                    有効にすると、ログイン時にパスワード（または Google 認証）に加えて、登録した電話番号宛の SMS
                    確認コードが必要になります。
                </p>
                <TwoFactorSettings initialEnabled={status.enabled} initialFactorId={status.factorId} />
            </div>
        </div>
    );
}
