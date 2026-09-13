import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import type { PackingItem } from '@/features/plans/types';

import { PackingList } from './PackingList';

const items: PackingItem[] = [
    { id: 'item-1', name: 'マスク', isChecked: true, isConfirmed: false, position: 0 },
    { id: 'item-2', name: 'フィン', isChecked: false, isConfirmed: false, position: 1 },
    { id: 'item-3', name: 'レギュレーター', isChecked: false, isConfirmed: false, position: 2 },
];

const meta = {
    title: 'features/plans/PackingList',
    component: PackingList,
    tags: ['autodocs'],
    parameters: { layout: 'padded' },
} satisfies Meta<typeof PackingList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 未チェック項目が残っている状態 */
export const Default: Story = {
    args: { planId: 'plan-1', items },
};

/** 全件チェック済みで「準備完了」が表示される状態 */
export const AllChecked: Story = {
    args: {
        planId: 'plan-1',
        items: items.map((item) => ({ ...item, isChecked: true })),
    },
};

/** 持ち物が 1 件もない状態 */
export const Empty: Story = {
    args: { planId: 'plan-1', items: [] },
};
