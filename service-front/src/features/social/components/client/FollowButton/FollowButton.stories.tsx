import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FollowButton } from './FollowButton';

const meta = {
    title: 'features/social/FollowButton',
    component: FollowButton,
    tags: ['autodocs'],
    parameters: { layout: 'padded' },
    args: { targetUserId: 'user-1' },
} satisfies Meta<typeof FollowButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NotFollowing: Story = {
    args: { initialIsFollowing: false },
};

export const Following: Story = {
    args: { initialIsFollowing: true },
};
