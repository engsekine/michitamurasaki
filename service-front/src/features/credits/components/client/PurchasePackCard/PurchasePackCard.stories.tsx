import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { LOG_CREDIT_PACKS } from '@/features/credits/constants';

import { PurchasePackCard } from './PurchasePackCard';

/**
 * ログパック購入カード（026 / FR-005）。
 *
 * 「購入する」ボタンは内部で Server Action（createCheckoutSession）を呼び出すため、
 * Storybook 上ではクリックしても実際の決済フローは起動しない。
 * パックごとの表示（価格・単価・割引率・おすすめバッジ）の確認を目的とした静的 story。
 */
const meta = {
    title: 'features/credits/PurchasePackCard',
    component: PurchasePackCard,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
    },
} satisfies Meta<typeof PurchasePackCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** お試しパック（10 枠 / ¥480）。割引・バッジなしの基準表示。 */
export const Trial: Story = {
    args: { pack: LOG_CREDIT_PACKS[0] },
};

/** おすすめパック（30 枠 / ¥1,200・約17%おトク）。おすすめバッジ + アクセント枠線つき。 */
export const Standard: Story = {
    args: { pack: LOG_CREDIT_PACKS[1] },
};

/** たっぷりパック（100 枠 / ¥3,000・約37%おトク）。 */
export const Bulk: Story = {
    args: { pack: LOG_CREDIT_PACKS[2] },
};
