import { NotificationBellPanel } from '@/features/notifications/components/client/NotificationBellPanel';
import { getUnreadNotificationCount, listNotifications } from '@/features/notifications/server/queries';

/**
 * ヘッダーの通知ベル（025 / FR-004）。
 * 未読件数と最新の通知（最初のページ）をサーバーで取得し、
 * ベルを押すとページ遷移なしのシートで通知を確認できる NotificationBellPanel に注入する。
 * 全件表示・追加読み込み・すべて既読は /notifications ページに任せる。
 */
export const NotificationBell = async () => {
    const [unreadCount, page] = await Promise.all([getUnreadNotificationCount(), listNotifications()]);

    return <NotificationBellPanel unreadCount={unreadCount} items={page.items} />;
};
