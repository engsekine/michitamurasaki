import { NotificationSettings } from '@/features/notifications';
import { listNotificationPreferences } from '@/features/notifications/server/queries';
import { Heading } from '@/shared/components/typography/Heading';
import { generatePageMetadata } from '@/shared/config/metadata';

export const metadata = generatePageMetadata(
    {
        slug: '/settings/notifications',
        title: '通知設定',
        description: '通知種別ごとの受け取り設定を変更します',
    },
    { noIndex: true },
);

/** 通知設定ページ（025 / US3 / FR-011）。行なし = ON を初期値として Client に渡す */
export default async function NotificationSettingsPage() {
    const preferences = await listNotificationPreferences();

    return (
        <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8">
            <Heading level={1}>通知設定</Heading>
            <NotificationSettings initialPreferences={preferences} />
        </div>
    );
}
