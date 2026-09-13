import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { NoCreditBanner } from './NoCreditBanner';

const meta = {
    title: 'features/credits/NoCreditBanner',
    component: NoCreditBanner,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
    },
} satisfies Meta<typeof NoCreditBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 購入導線あり（デフォルト）。ログパック購入リンクを含む完全表示。 */
export const Default: Story = {
    args: {
        showPurchaseLink: true,
    },
};

/**
 * 購入導線なし（US1 単独リリース時）。
 * /settings/log-credits ページが未提供のフェーズでは
 * showPurchaseLink=false にしてデイリーボーナス説明のみ表示する。
 */
export const WithoutPurchaseLink: Story = {
    args: {
        showPurchaseLink: false,
    },
};
