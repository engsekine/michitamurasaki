import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { TimelineTabs } from './TimelineTabs';

const meta = {
    title: 'features/social/TimelineTabs',
    component: TimelineTabs,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
    },
} satisfies Meta<typeof TimelineTabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ActiveTimeline: Story = {
    args: {
        active: 'timeline',
    },
};

export const ActiveLikes: Story = {
    args: {
        active: 'likes',
    },
};
