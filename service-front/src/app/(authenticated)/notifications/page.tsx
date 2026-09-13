import { Settings } from 'lucide-react';
import Link from 'next/link';

import { NotificationList } from '@/features/notifications';
import { ensureTimedNotifications, listNotifications } from '@/features/notifications/server/queries';
import { Heading } from '@/shared/components/typography/Heading';
import { generatePageMetadata } from '@/shared/config/metadata';

export const metadata = generatePageMetadata(
    {
        slug: '/notifications',
        title: '通知',
        description: 'あなた宛の通知の一覧です',
    },
    { noIndex: true },
);

/**
 * 通知一覧ページ（025 / US1 / FR-003）。
 * 表示前にリマインド通知の遅延生成 + 90 日清掃を行い（FR-009/010/013）、
 * 最初の 20 件を Client の NotificationList に渡す。
 */
export default async function NotificationsPage() {
    await ensureTimedNotifications();
    const page = await listNotifications();
    const unreadCount = page.items.filter((item) => item.readAt === null).length;

    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
            <div className="flex items-center justify-between gap-2">
                <Heading level={1}>通知</Heading>
                <Link
                    href="/settings/notifications"
                    aria-label="通知設定"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                >
                    <Settings aria-hidden="true" className="size-5" />
                </Link>
            </div>
            <NotificationList initialItems={page.items} initialCursor={page.nextCursor} unreadCount={unreadCount} />
        </div>
    );
}
