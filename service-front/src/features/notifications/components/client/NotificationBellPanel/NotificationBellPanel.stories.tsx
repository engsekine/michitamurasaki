import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import type { NotificationItem } from '@/features/notifications/server/queries';

import { NotificationBellPanel } from './NotificationBellPanel';

// NotificationList.stories.tsx と同じダミーデータ定義を流用し、
// unreadCount と items の組み合わせでバリエーションを表現する
const allItems: NotificationItem[] = [
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
        type: 'log_liked',
        actorId: 'user-3',
        actorNickname: 'うみべちゃん',
        resourceId: 'dive-2',
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
    title: 'features/notifications/NotificationBellPanel',
    component: NotificationBellPanel,
    tags: ['autodocs'],
    parameters: {
        // Sheet（オーバーレイ）を含むため padded で余白を確保する
        layout: 'padded',
    },
} satisfies Meta<typeof NotificationBellPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 未読あり・数件の通常状態。バッジに件数が表示される */
export const Default: Story = {
    args: {
        unreadCount: 1,
        items: allItems,
    },
};

/** 全件既読状態。バッジは表示されず aria-label は「通知」になる */
export const NoUnread: Story = {
    args: {
        unreadCount: 0,
        items: allItems.map((item) => ({
            ...item,
            readAt: item.readAt ?? '2026-07-01T10:00:00+00:00',
        })),
    },
};

/** 未読が上限（9）を超える状態。バッジに「9+」と表示される */
export const ManyUnread: Story = {
    args: {
        unreadCount: 12,
        items: allItems.map((item) => ({ ...item, readAt: null })),
    },
};

/** 通知が 0 件の状態。パネルを開くと「通知はありません」が表示される */
export const Empty: Story = {
    args: {
        unreadCount: 0,
        items: [],
    },
};
