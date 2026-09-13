import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { UserSearchBar } from './UserSearchBar';

const meta = {
    title: 'features/social/UserSearchBar',
    component: UserSearchBar,
    tags: ['autodocs'],
    parameters: { layout: 'padded' },
} satisfies Meta<typeof UserSearchBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 既定表示（ユーザーID入力欄 + 検索ボタン）。送信すると /users/search?q=... へ遷移する */
export const Default: Story = {};
