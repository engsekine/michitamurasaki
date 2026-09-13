import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ShopMap } from './ShopMap';

const meta = {
    title: 'features/shops/ShopMap',
    component: ShopMap,
    tags: ['autodocs'],
    parameters: { layout: 'padded' },
} satisfies Meta<typeof ShopMap>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 座標あり（Google マップ iframe を表示） */
export const WithCoordinates: Story = {
    args: {
        latitude: 34.9066,
        longitude: 139.1325,
        shopName: 'マリンステージ',
    },
};

/** 座標なし（位置を特定できない場合のメッセージ表示・FR-013） */
export const Unavailable: Story = {
    args: {
        latitude: null,
        longitude: null,
        shopName: 'マリンステージ',
    },
};
