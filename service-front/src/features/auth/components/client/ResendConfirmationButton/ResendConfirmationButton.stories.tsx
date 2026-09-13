import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ResendConfirmationButton } from './ResendConfirmationButton';

const meta = {
    title: 'features/auth/ResendConfirmationButton',
    component: ResendConfirmationButton,
    tags: ['autodocs'],
    parameters: { layout: 'padded' },
} satisfies Meta<typeof ResendConfirmationButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** サインアップ完了直後など、宛先が分かっている場合（ボタンのみ） */
export const WithKnownEmail: Story = {
    args: { email: 'user@example.com' },
};

/** ログイン画面の未確認導線など、宛先を入力させる場合（メール入力欄あり） */
export const WithEmailInput: Story = {
    args: {},
};
