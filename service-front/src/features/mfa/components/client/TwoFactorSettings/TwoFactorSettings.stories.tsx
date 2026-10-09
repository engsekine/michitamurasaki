import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { TwoFactorSettings } from './TwoFactorSettings';

const meta = {
    title: 'features/mfa/TwoFactorSettings',
    component: TwoFactorSettings,
    tags: ['autodocs'],
    parameters: { layout: 'padded' },
} satisfies Meta<typeof TwoFactorSettings>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 未有効化: 認証アプリの設定を開始する導線 */
export const Disabled: Story = {
    args: { initialEnabled: false, initialFactorId: null },
};

/** 有効化済み: 無効化ボタンを表示 */
export const Enabled: Story = {
    args: { initialEnabled: true, initialFactorId: 'factor-1' },
};
