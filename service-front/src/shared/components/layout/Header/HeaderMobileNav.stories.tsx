import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { Route } from 'next';
import { HeaderMobileNav } from './HeaderMobileNav';

// NOTE: トリガーボタンは `md:hidden` のため、Storybook がデスクトップ幅で
// レンダリングされると非表示になります。各 Story には viewport を mobile に
// 設定してあるため、Canvas を「Mobile」ビューポートで確認してください。
// シートを開いた状態を確認したい場合は、トリガーボタンをクリックしてください。

const meta = {
    title: 'shared/layout/HeaderMobileNav',
    component: HeaderMobileNav,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        // トリガーボタン（md:hidden）が確実に表示されるよう mobile に固定
        viewport: {
            defaultViewport: 'mobile1',
        },
    },
} satisfies Meta<typeof HeaderMobileNav>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 標準的な複数ナビゲーション項目 */
export const Default: Story = {
    args: {
        items: [
            { href: '/dives' as Route, label: 'ダイビングログ' },
            { href: '/likes' as Route, label: 'いいね' },
        ],
    },
};

/** ナビゲーション項目が 1 件のみの場合 */
export const SingleItem: Story = {
    args: {
        items: [{ href: '/dives' as Route, label: 'ダイビングログ' }],
    },
};

/** ナビゲーション項目が空の場合（シートが空になる） */
export const EmptyItems: Story = {
    args: {
        items: [],
    },
};
