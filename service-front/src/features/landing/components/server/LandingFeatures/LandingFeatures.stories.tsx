import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { LandingFeatures } from './LandingFeatures';

const meta = {
    title: 'features/landing/LandingFeatures',
    component: LandingFeatures,
    tags: ['autodocs'],
    parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof LandingFeatures>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 機能紹介 4 件（画面イメージ付き） */
export const Default: Story = {};
