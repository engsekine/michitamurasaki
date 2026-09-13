import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';

import { ConfirmDialog } from './ConfirmDialog';

const meta = {
    title: 'shared/feedback/ConfirmDialog',
    component: ConfirmDialog,
    tags: ['autodocs'],
    args: {
        open: true,
        onOpenChange: fn(),
        onConfirm: fn(),
        title: 'ログを削除しますか？',
        description: 'この操作は取り消せません。ログに添付された写真も削除されます。',
    },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Destructive: Story = {
    args: {
        destructive: true,
        confirmLabel: '削除する',
    },
};

export const Pending: Story = {
    args: {
        destructive: true,
        confirmLabel: '削除する',
        isPending: true,
    },
};
