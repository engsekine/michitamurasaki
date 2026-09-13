import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { LikeButton } from './LikeButton';

const meta = {
    title: 'features/social/LikeButton',
    component: LikeButton,
    tags: ['autodocs'],
    parameters: { layout: 'padded' },
    args: { diveId: 'dive-1' },
} satisfies Meta<typeof LikeButton>;

export default meta;
type Story = StoryObj<typeof meta>;

// 未いいね・件数 0 件
export const NotLiked: Story = {
    args: {
        initialIsLiked: false,
        initialCount: 0,
    },
};

// いいね済み・件数 3 件（アイコン塗り + aria-pressed の確認）
export const Liked: Story = {
    args: {
        initialIsLiked: true,
        initialCount: 3,
    },
};

// 件数多め（桁数増加によるレイアウト崩れの確認）
export const HighCount: Story = {
    args: {
        initialIsLiked: false,
        initialCount: 128,
    },
};
