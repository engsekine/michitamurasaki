import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NotificationItem } from '@/features/notifications/server/queries';

const push = vi.fn();
const refresh = vi.fn();
const markNotificationRead = vi.fn();
const markAllNotificationsRead = vi.fn();
const loadMoreNotifications = vi.fn();

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push, refresh }),
}));
vi.mock('@/features/notifications/server/actions', () => ({
    markNotificationRead: (...args: unknown[]) => markNotificationRead(...args),
    markAllNotificationsRead: (...args: unknown[]) => markAllNotificationsRead(...args),
    loadMoreNotifications: (...args: unknown[]) => loadMoreNotifications(...args),
}));

import { NotificationList } from './NotificationList';

const buildItem = (overrides: Partial<NotificationItem> = {}): NotificationItem => ({
    id: 'notification-1',
    type: 'followed',
    actorId: 'user-1',
    actorNickname: 'ダイバー太郎',
    actorHandle: 'diver-taro',
    resourceId: null,
    occurredAt: '2026-07-01T03:00:00+00:00',
    readAt: null,
    ...overrides,
});

describe('NotificationList', () => {
    beforeEach(() => {
        push.mockReset();
        refresh.mockReset();
        markNotificationRead.mockReset().mockResolvedValue({ success: true });
        markAllNotificationsRead.mockReset().mockResolvedValue({ success: true });
        loadMoreNotifications.mockReset();
    });

    it('通知が 0 件なら空状態を表示する', () => {
        render(<NotificationList initialItems={[]} initialCursor={null} unreadCount={0} />);
        expect(screen.getByText('通知はありません')).toBeInTheDocument();
    });

    it('文言テンプレートの {nickname} を actorNickname で置換して表示する', () => {
        render(<NotificationList initialItems={[buildItem()]} initialCursor={null} unreadCount={1} />);
        expect(screen.getByText('ダイバー太郎 さんにフォローされました')).toBeInTheDocument();
        expect(screen.getByText('未読')).toBeInTheDocument();
        expect(screen.getByText('2026/07/01')).toBeInTheDocument();
    });

    it('タップで markNotificationRead を実行してから遷移先へ push する', async () => {
        const user = userEvent.setup();
        render(<NotificationList initialItems={[buildItem()]} initialCursor={null} unreadCount={1} />);

        await user.click(screen.getByRole('button', { name: /ダイバー太郎 さんにフォローされました/ }));

        await waitFor(() => expect(markNotificationRead).toHaveBeenCalledWith('notification-1'));
        await waitFor(() => expect(push).toHaveBeenCalledWith('/users/diver-taro'));
    });

    it('既読化が失敗しても遷移は続行する', async () => {
        markNotificationRead.mockRejectedValue(new Error('offline'));
        vi.spyOn(console, 'error').mockImplementation(() => {
            /* エラーログを抑止 */
        });
        const user = userEvent.setup();
        render(<NotificationList initialItems={[buildItem()]} initialCursor={null} unreadCount={1} />);

        await user.click(screen.getByRole('button', { name: /ダイバー太郎 さんにフォローされました/ }));

        await waitFor(() => expect(push).toHaveBeenCalledWith('/users/diver-taro'));
    });

    it('actor 退会時は「退会したユーザー」を表示しリンク無効（ボタンにしない）', () => {
        render(
            <NotificationList
                initialItems={[buildItem({ actorId: null, actorNickname: null })]}
                initialCursor={null}
                unreadCount={1}
            />,
        );
        expect(screen.getByText('退会したユーザー さんにフォローされました')).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: /退会したユーザー さんにフォローされました/ }),
        ).not.toBeInTheDocument();
    });

    it('「すべて既読にする」で markAllNotificationsRead を呼び refresh する', async () => {
        const user = userEvent.setup();
        render(<NotificationList initialItems={[buildItem()]} initialCursor={null} unreadCount={1} />);

        await user.click(screen.getByRole('button', { name: 'すべて既読にする' }));

        await waitFor(() => expect(markAllNotificationsRead).toHaveBeenCalled());
        await waitFor(() => expect(refresh).toHaveBeenCalled());
    });

    it('全既読の失敗はエラーを表示し refresh しない', async () => {
        markAllNotificationsRead.mockResolvedValue({ success: false, error: '通知の既読化に失敗しました' });
        const user = userEvent.setup();
        render(<NotificationList initialItems={[buildItem()]} initialCursor={null} unreadCount={1} />);

        await user.click(screen.getByRole('button', { name: 'すべて既読にする' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('通知の既読化に失敗しました');
        expect(refresh).not.toHaveBeenCalled();
    });

    it('未読 0 件なら「すべて既読にする」は非活性', () => {
        render(
            <NotificationList
                initialItems={[buildItem({ readAt: '2026-07-01T04:00:00+00:00' })]}
                initialCursor={null}
                unreadCount={0}
            />,
        );
        expect(screen.getByRole('button', { name: 'すべて既読にする' })).toBeDisabled();
    });

    it('「さらに読み込む」で次ページを追記し、nextCursor null でボタンを消す', async () => {
        loadMoreNotifications.mockResolvedValue({
            items: [
                buildItem({
                    id: 'notification-2',
                    type: 'overhaul_reminder',
                    actorId: null,
                    actorNickname: null,
                    actorHandle: null,
                    readAt: '2026-06-01T00:00:00+00:00',
                }),
            ],
            nextCursor: null,
        });
        const user = userEvent.setup();
        render(
            <NotificationList
                initialItems={[buildItem()]}
                initialCursor={{ occurredAt: '2026-07-01T03:00:00+00:00', id: 'notification-1' }}
                unreadCount={1}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'さらに読み込む' }));

        expect(loadMoreNotifications).toHaveBeenCalledWith({
            occurredAt: '2026-07-01T03:00:00+00:00',
            id: 'notification-1',
        });
        expect(await screen.findByText('レギュレーターの OH 期限が到来しました')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'さらに読み込む' })).not.toBeInTheDocument();
    });

    it('追加読み込みの失敗はエラーを表示する', async () => {
        loadMoreNotifications.mockRejectedValue(new Error('network'));
        vi.spyOn(console, 'error').mockImplementation(() => {
            /* エラーログを抑止 */
        });
        const user = userEvent.setup();
        render(
            <NotificationList
                initialItems={[buildItem()]}
                initialCursor={{ occurredAt: '2026-07-01T03:00:00+00:00', id: 'notification-1' }}
                unreadCount={1}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'さらに読み込む' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('通知の読み込みに失敗しました');
    });
});
