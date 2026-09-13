import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { LandingPricing } from './LandingPricing';

const meta = {
    title: 'features/landing/LandingPricing',
    component: LandingPricing,
    tags: ['autodocs'],
    parameters: { layout: 'fullscreen' },
    args: {
        packs: [
            {
                quantity: 10,
                amountJpy: 480,
                displayName: 'お試しパック（10 枠）',
                discountLabel: null,
                isRecommended: false,
            },
            {
                quantity: 30,
                amountJpy: 1200,
                displayName: 'おすすめパック（30 枠）',
                discountLabel: '約17%おトク',
                isRecommended: true,
            },
            {
                quantity: 100,
                amountJpy: 3000,
                displayName: 'たっぷりパック（100 枠）',
                discountLabel: '約37%おトク',
                isRecommended: false,
            },
        ],
        initialGrantAmount: 10,
        dailyBonusAmount: 1,
    },
} satisfies Meta<typeof LandingPricing>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 現行価格（お試し 10 枠 480 円 / おすすめ 30 枠 1,200 円 / たっぷり 100 枠 3,000 円） */
export const Default: Story = {};
