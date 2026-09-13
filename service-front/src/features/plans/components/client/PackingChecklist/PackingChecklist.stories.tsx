import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import type { PackingItem } from '@/features/plans/types';

import { PackingChecklist } from './PackingChecklist';

const mixedItems: PackingItem[] = [
    { id: 'item-1', name: 'マスク', isChecked: true, isConfirmed: false, position: 0 },
    { id: 'item-2', name: 'フィン', isChecked: false, isConfirmed: false, position: 1 },
    { id: 'item-3', name: 'レギュレーター', isChecked: true, isConfirmed: false, position: 2 },
    { id: 'item-4', name: 'BCD', isChecked: false, isConfirmed: false, position: 3 },
    { id: 'item-5', name: 'ウェットスーツ', isChecked: false, isConfirmed: false, position: 4 },
];

const meta = {
    title: 'features/plans/PackingChecklist',
    component: PackingChecklist,
    tags: ['autodocs'],
    parameters: { layout: 'padded' },
} satisfies Meta<typeof PackingChecklist>;

export default meta;
type Story = StoryObj<typeof meta>;

/** チェック済み・未チェックが混在している通常状態 */
export const Default: Story = {
    args: { items: mixedItems },
};

/** 全件チェック済みの状態 */
export const AllChecked: Story = {
    args: {
        items: mixedItems.map((item) => ({ ...item, isChecked: true })),
    },
};

/** 持ち物が 0 件のとき「持ち物はまだありません」が表示される */
export const Empty: Story = {
    args: { items: [] },
};

/** 12 件以上あり縦スクロールが発生する状態（max-h-40 を超える） */
export const ManyItems: Story = {
    args: {
        items: [
            { id: 'item-1', name: 'マスク', isChecked: true, isConfirmed: false, position: 0 },
            { id: 'item-2', name: 'フィン', isChecked: false, isConfirmed: false, position: 1 },
            { id: 'item-3', name: 'レギュレーター', isChecked: true, isConfirmed: false, position: 2 },
            { id: 'item-4', name: 'BCD', isChecked: false, isConfirmed: false, position: 3 },
            { id: 'item-5', name: 'ウェットスーツ', isChecked: true, isConfirmed: false, position: 4 },
            { id: 'item-6', name: 'ダイブコンピューター', isChecked: false, isConfirmed: false, position: 5 },
            { id: 'item-7', name: 'タンク', isChecked: false, isConfirmed: false, position: 6 },
            { id: 'item-8', name: 'ウェイト', isChecked: true, isConfirmed: false, position: 7 },
            { id: 'item-9', name: 'ライト', isChecked: false, isConfirmed: false, position: 8 },
            { id: 'item-10', name: 'カメラ', isChecked: false, isConfirmed: false, position: 9 },
            { id: 'item-11', name: 'ログブック', isChecked: true, isConfirmed: false, position: 10 },
            { id: 'item-12', name: 'Cカード', isChecked: false, isConfirmed: false, position: 11 },
        ],
    },
};
