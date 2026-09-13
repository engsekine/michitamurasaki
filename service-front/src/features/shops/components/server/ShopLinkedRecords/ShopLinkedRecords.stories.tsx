import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ShopLinkedRecords } from './ShopLinkedRecords';

const meta = {
    title: 'features/shops/ShopLinkedRecords',
    component: ShopLinkedRecords,
    tags: ['autodocs'],
    parameters: { layout: 'padded' },
} satisfies Meta<typeof ShopLinkedRecords>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 予定・ログとも紐付きあり */
export const Default: Story = {
    args: {
        plans: [
            { id: 'plan-1', plannedOn: '2026-07-12', location: '伊豆 / 田子' },
            { id: 'plan-2', plannedOn: '2026-08-20', location: '和歌山 / 串本' },
        ],
        dives: [
            { id: 'dive-1', diveDate: '2026-06-14', location: '伊豆 / 大瀬崎' },
            { id: 'dive-2', diveDate: '2026-06-01', location: '千葉 / 伊戸' },
        ],
    },
};

/** 紐付きなし（両セクションとも空メッセージ） */
export const Empty: Story = {
    args: { plans: [], dives: [] },
};

/** 予定のみ紐付きあり */
export const PlansOnly: Story = {
    args: {
        plans: [{ id: 'plan-1', plannedOn: '2026-07-12', location: '伊豆 / 田子' }],
        dives: [],
    },
};
