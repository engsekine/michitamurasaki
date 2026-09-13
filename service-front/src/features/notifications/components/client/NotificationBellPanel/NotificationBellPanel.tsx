'use client';

import { Bell } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { UNREAD_BADGE_MAX } from '@/features/notifications/constants';
import {
    buildNotificationMessage,
    formatOccurredAtJst,
    isNotificationActorDeleted,
} from '@/features/notifications/lib/notificationDisplay';
import { getNotificationTarget } from '@/features/notifications/lib/notificationTarget';
import { markNotificationRead } from '@/features/notifications/server/actions';
import type { NotificationItem } from '@/features/notifications/server/queries';
import { Button } from '@/shared/components/ui/Button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/shared/components/ui/Sheet';

interface NotificationBellPanelProps {
    /** 未読件数（バッジ表示 + aria-label に使用） */
    unreadCount: number;
    /** 表示する通知（新しい順・最初のページ）。データ取得はサーバー側（NotificationBell）で行う */
    items: NotificationItem[];
}

/**
 * ヘッダーの通知ベル + 通知パネル（025 / FR-004）。
 * ベルを押すとページ遷移せずシートで通知を確認でき、項目タップで既読化してから遷移先へ移動する。
 * 全件・追加読み込み・すべて既読は /notifications（NotificationList）に任せる。
 */
export const NotificationBellPanel = ({ unreadCount, items }: NotificationBellPanelProps) => {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);

    const label = unreadCount > 0 ? `通知（未読 ${unreadCount} 件）` : '通知';
    const badgeText = unreadCount > UNREAD_BADGE_MAX ? `${UNREAD_BADGE_MAX}+` : `${unreadCount}`;

    const handleItemClick = async (item: NotificationItem, href: string) => {
        /** 既読化の失敗（オフライン等）は遷移を妨げない（NotificationList と同方針） */
        try {
            await markNotificationRead(item.id);
        } catch (markError) {
            console.error('[NotificationBellPanel] 既読化に失敗しました:', markError);
        }
        setIsOpen(false);
        router.push(href as Route);
    };

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" aria-label={label} className="relative" />}>
                <Bell aria-hidden="true" className="size-5" />
                {unreadCount > 0 && (
                    <span
                        aria-hidden="true"
                        className="-top-1 -right-1 absolute inline-flex min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-white text-xs leading-4"
                    >
                        {badgeText}
                    </span>
                )}
            </SheetTrigger>
            <SheetContent side="right">
                <SheetHeader>
                    <SheetTitle>通知</SheetTitle>
                </SheetHeader>
                <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
                    {items.length === 0 ? (
                        <p className="py-8 text-center text-muted-foreground text-sm">通知はありません</p>
                    ) : (
                        <ul className="flex flex-col divide-y divide-border overflow-y-auto">
                            {items.map((item) => {
                                const { href } = getNotificationTarget(item);
                                const isUnread = item.readAt === null;
                                const isClickable = href !== null && !isNotificationActorDeleted(item);

                                const content = (
                                    <>
                                        <span className="flex items-center gap-2">
                                            {/* red-600 だと未読行の bg-blue-50 上でコントラスト AA 未達のため red-700 を使う */}
                                            {isUnread && (
                                                <span className="inline-flex shrink-0 rounded-full border border-red-700 px-1.5 text-red-700 text-xs">
                                                    未読
                                                </span>
                                            )}
                                            <span className="text-sm">{buildNotificationMessage(item)}</span>
                                        </span>
                                        {/* 未読行の背景上では text-muted-foreground がコントラスト AA 未達のため text-foreground を使う */}
                                        <span
                                            className={
                                                isUnread ? 'text-foreground text-xs' : 'text-muted-foreground text-xs'
                                            }
                                        >
                                            {formatOccurredAtJst(item.occurredAt)}
                                        </span>
                                    </>
                                );

                                return (
                                    <li key={item.id} className={isUnread ? 'bg-blue-50 dark:bg-muted' : undefined}>
                                        {isClickable ? (
                                            <button
                                                type="button"
                                                onClick={() => handleItemClick(item, href)}
                                                className="flex w-full flex-col items-start gap-1 px-3 py-3 text-left transition-colors hover:bg-muted"
                                            >
                                                {content}
                                            </button>
                                        ) : (
                                            <div className="flex w-full flex-col items-start gap-1 px-3 py-3">
                                                {content}
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    <Link
                        href="/notifications"
                        onClick={() => setIsOpen(false)}
                        className="rounded-md px-3 py-2 text-center text-primary text-sm transition-colors hover:bg-muted"
                    >
                        すべての通知を見る
                    </Link>
                </div>
            </SheetContent>
        </Sheet>
    );
};
