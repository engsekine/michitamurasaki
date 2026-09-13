import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DiveVisibilityToggle } from './DiveVisibilityToggle';

const meta = {
    title: 'features/dives/DiveVisibilityToggle',
    component: DiveVisibilityToggle,
    tags: ['autodocs'],
    parameters: { layout: 'padded' },
    args: { diveId: 'dive-1' },
} satisfies Meta<typeof DiveVisibilityToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Private: Story = {
    args: { initialIsPublic: false },
};

export const Public: Story = {
    args: { initialIsPublic: true },
};
