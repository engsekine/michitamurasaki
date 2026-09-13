import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ShopForm } from './ShopForm';

const meta = {
    title: 'features/shops/ShopForm',
    component: ShopForm,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        nextjs: {
            appDirectory: true,
            navigation: { pathname: '/shops/new' },
        },
    },
} satisfies Meta<typeof ShopForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 新規登録モード（shopId 未指定・全フィールド空） */
export const NewMode: Story = {};

/** 編集モード（shopId + defaultValues 指定） */
export const EditMode: Story = {
    args: {
        shopId: 'sample-shop-id',
        defaultValues: {
            name: 'マリンステージ',
            address: '静岡県伊東市富戸 837-2',
            phone: '0557-51-3535',
            websiteUrl: 'https://example.com',
            memo: '器材レンタルあり。駐車場無料。',
        },
    },
};
