import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CookieConsentBanner } from './CookieConsentBanner';

const meta = {
    title: 'features/consent/CookieConsentBanner',
    component: CookieConsentBanner,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
    },
} satisfies Meta<typeof CookieConsentBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 未選択: バナーを表示 */
export const Unset: Story = {
    args: {
        initialConsent: null,
    },
};

/** 選択済み: 非表示（何も描画しない） */
export const Accepted: Story = {
    args: {
        initialConsent: 'accepted',
    },
};
