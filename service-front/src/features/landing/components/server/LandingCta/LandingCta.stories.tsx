import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { LandingCta } from './LandingCta';

const meta = {
    title: 'features/landing/LandingCta',
    component: LandingCta,
    tags: ['autodocs'],
    parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof LandingCta>;

export default meta;
type Story = StoryObj<typeof meta>;

/** ページ最下部の締め CTA */
export const Default: Story = {};
