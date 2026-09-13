import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import type { NotificationItem } from '@/features/notifications/server/queries';

import { NotificationList } from './NotificationList';

const items: NotificationItem[] = [
    {
        id: 'notification-1',
        type: 'followed',
        actorId: 'user-1',
        actorNickname: 'ダイバー太郎',
        resourceId: null,
        occurredAt: '2026-07-01T03:00:00+00:00',
        readAt: null,
    },
    {
        id: 'notification-2',
        type: 'buddy_tagged',
        actorId: 'user-2',
        actorNickname: '海子',
        resourceId: 'dive-1',
        occurredAt: '2026-06-30T09:00:00+00:00',
        readAt: '2026-06-30T10:00:00+00:00',
    },
    {
        id: 'notification-3',
        type: 'followed',
        actorId: null,
        actorNickname: null,
        resourceId: null,
        occurredAt: '2026-06-29T01:00:00+00:00',
        readAt: '2026-06-29T02:00:00+00:00',
    },
    {
        id: 'notification-4',
        type: 'plan_reminder',
        actorId: null,
        actorNickname: null,
        resourceId: 'plan-1',
        occurredAt: '2026-06-28T00:00:00+00:00',
        readAt: '2026-06-28T01:00:00+00:00',
    },
    {
        id: 'notification-5',
        type: 'overhaul_reminder',
        actorId: null,
        actorNickname: null,
        resourceId: 'regulator-1',
        occurredAt: '2026-06-27T00:00:00+00:00',
        readAt: '2026-06-27T01:00:00+00:00',
    },
];

const meta = {
    title: 'features/notifications/NotificationList',
    component: NotificationList,
    tags: ['autodocs'],
    parameters: { layout: 'padded' },
    args: {
        initialItems: items,
        initialCursor: null,
        unreadCount: 1,
    },
} satisfies Meta<typeof NotificationList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 未読が複数あり、次ページ（さらに読み込む）も存在する状態 */
export const Unread: Story = {
    args: {
        initialItems: items.map((item) => ({ ...item, readAt: null })),
        initialCursor: { occurredAt: '2026-06-27T00:00:00+00:00', id: 'notification-5' },
        unreadCount: 5,
    },
};

/** 通知 0 件の空状態 */
export const Empty: Story = {
    args: {
        initialItems: [],
        initialCursor: null,
        unreadCount: 0,
    },
};
