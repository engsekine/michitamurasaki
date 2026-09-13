import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ShopList } from './ShopList';

const meta = {
    title: 'features/shops/ShopList',
    component: ShopList,
    tags: ['autodocs'],
    parameters: { layout: 'padded' },
} satisfies Meta<typeof ShopList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 複数件（住所・電話あり / なし混在） */
export const Default: Story = {
    args: {
        shops: [
            {
                id: 'shop-1',
                name: 'マリンクラブ石垣',
                address: '沖縄県石垣市白保 123-4',
                phone: '0980-00-1111',
            },
            {
                id: 'shop-2',
                name: 'ダイブサービス沖縄',
                address: '沖縄県那覇市牧志 5-6-7',
                phone: '',
            },
            {
                id: 'shop-3',
                name: 'ブルーオーシャン宮古',
                address: '',
                phone: '',
            },
        ],
    },
};

/** 住所・電話なし混在（任意項目が未入力のショップが含まれる） */
export const PartialFields: Story = {
    args: {
        shops: [
            {
                id: 'shop-partial-1',
                name: 'ブルーオーシャン宮古',
                address: '',
                phone: '',
            },
            {
                id: 'shop-partial-2',
                name: 'ダイブショップ八重山',
                address: '沖縄県石垣市登野城 99',
                phone: '',
            },
            {
                id: 'shop-partial-3',
                name: 'シーフレンズ本部',
                address: '',
                phone: '0980-00-3333',
            },
        ],
    },
};

/** 1 件のみ */
export const SingleItem: Story = {
    args: {
        shops: [
            {
                id: 'shop-single',
                name: 'マリンクラブ石垣',
                address: '沖縄県石垣市白保 123-4',
                phone: '0980-00-1111',
            },
        ],
    },
};

/** 0 件（登録導線付きの空状態） */
export const Empty: Story = {
    args: { shops: [] },
};
