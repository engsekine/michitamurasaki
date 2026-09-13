import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { NotificationSettings } from './NotificationSettings';

const meta = {
    title: 'features/notifications/NotificationSettings',
    component: NotificationSettings,
    tags: ['autodocs'],
    parameters: { layout: 'padded' },
} satisfies Meta<typeof NotificationSettings>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 既定状態: 行なし = 全種別 ON */
export const Default: Story = {
    args: { initialPreferences: {} },
};

/** 一部 OFF: is_enabled = false の行がある種別だけ OFF 表示 */
export const PartiallyDisabled: Story = {
    args: { initialPreferences: { plan_reminder: false, overhaul_reminder: false } },
};
