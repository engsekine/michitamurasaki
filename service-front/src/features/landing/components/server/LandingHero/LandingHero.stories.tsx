import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { LandingHero } from './LandingHero';

const meta = {
    title: 'features/landing/LandingHero',
    component: LandingHero,
    tags: ['autodocs'],
    parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof LandingHero>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 既定のファーストビュー */
export const Default: Story = {};
