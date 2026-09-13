import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NotificationItem } from '@/features/notifications/server/queries';

const getUnreadNotificationCount = vi.fn();
const listNotifications = vi.fn();
const markNotificationRead = vi.fn();
const routerPush = vi.fn();

vi.mock('@/features/notifications/server/queries', () => ({
    getUnreadNotificationCount: () => getUnreadNotificationCount(),
    listNotifications: () => listNotifications(),
}));

vi.mock('@/features/notifications/server/actions', () => ({
    markNotificationRead: (...args: unknown[]) => markNotificationRead(...args),
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: routerPush, refresh: vi.fn() }),
}));

import { NotificationBell } from './NotificationBell';

const buildItem = (overrides: Partial<NotificationItem> = {}): NotificationItem => ({
    id: 'n1',
    type: 'followed',
    actorId: 'user-1',
    actorNickname: 'たろう',
    actorHandle: 'taro',
    resourceId: null,
    occurredAt: '2026-07-01T12:00:00+09:00',
    readAt: null,
    ...overrides,
});

describe('NotificationBell', () => {
    beforeEach(() => {
        getUnreadNotificationCount.mockReset();
        listNotifications.mockReset();
        markNotificationRead.mockReset();
        routerPush.mockReset();
        listNotifications.mockResolvedValue({ items: [], nextCursor: null });
    });

    it('未読 0 件はバッジを出さず aria-label は「通知」のボタンを表示する', async () => {
        getUnreadNotificationCount.mockResolvedValue(0);
        render(await NotificationBell());

        const button = screen.getByRole('button', { name: '通知' });
        expect(button).not.toHaveTextContent(/\d/);
    });

    it('未読 3 件はバッジに件数を表示し aria-label に未読数を含める', async () => {
        getUnreadNotificationCount.mockResolvedValue(3);
        render(await NotificationBell());

        expect(screen.getByRole('button', { name: '通知（未読 3 件）' })).toHaveTextContent('3');
    });

    it('未読 12 件（上限超え）はバッジを「9+」に丸める', async () => {
        getUnreadNotificationCount.mockResolvedValue(12);
        render(await NotificationBell());

        expect(screen.getByRole('button', { name: '通知（未読 12 件）' })).toHaveTextContent('9+');
    });

    it('ベルを押すとシートが開き、通知と「すべての通知を見る」導線が表示される', async () => {
        getUnreadNotificationCount.mockResolvedValue(1);
        listNotifications.mockResolvedValue({ items: [buildItem()], nextCursor: null });
        const user = userEvent.setup();
        render(await NotificationBell());

        await user.click(screen.getByRole('button', { name: '通知（未読 1 件）' }));

        const sheet = await screen.findByRole('dialog', { name: '通知' });
        expect(within(sheet).getByText(/たろう/)).toBeInTheDocument();
        expect(within(sheet).getByText('未読')).toBeInTheDocument();
        expect(within(sheet).getByRole('link', { name: 'すべての通知を見る' })).toHaveAttribute(
            'href',
            '/notifications',
        );
    });

    it('通知が 0 件のときはシート内に空メッセージを表示する', async () => {
        getUnreadNotificationCount.mockResolvedValue(0);
        const user = userEvent.setup();
        render(await NotificationBell());

        await user.click(screen.getByRole('button', { name: '通知' }));

        const sheet = await screen.findByRole('dialog', { name: '通知' });
        expect(within(sheet).getByText('通知はありません')).toBeInTheDocument();
    });

    it('通知をタップすると既読化してから遷移先へ移動する', async () => {
        getUnreadNotificationCount.mockResolvedValue(1);
        listNotifications.mockResolvedValue({ items: [buildItem({ id: 'n9', actorId: 'user-9' })], nextCursor: null });
        markNotificationRead.mockResolvedValue({ success: true });
        const user = userEvent.setup();
        render(await NotificationBell());

        await user.click(screen.getByRole('button', { name: '通知（未読 1 件）' }));
        const sheet = await screen.findByRole('dialog', { name: '通知' });
        await user.click(within(sheet).getByRole('button', { name: /たろう/ }));

        expect(markNotificationRead).toHaveBeenCalledWith('n9');
        // 034: 遷移先はユーザー ID の URL になる
        expect(routerPush).toHaveBeenCalledWith('/users/taro');
    });
});
