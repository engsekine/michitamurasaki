import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import type { PackingItem } from '@/features/plans/types';

import { ForgottenItemChecklist } from './ForgottenItemChecklist';

const unconfirmedItems: PackingItem[] = [
    { id: 'item-1', name: 'マスク', isChecked: true, isConfirmed: false, position: 0 },
    { id: 'item-2', name: 'フィン', isChecked: true, isConfirmed: false, position: 1 },
    { id: 'item-3', name: 'レギュレーター', isChecked: true, isConfirmed: false, position: 2 },
    { id: 'item-4', name: 'BCD', isChecked: true, isConfirmed: false, position: 3 },
    { id: 'item-5', name: 'ウェットスーツ', isChecked: true, isConfirmed: false, position: 4 },
];

const meta = {
    title: 'features/plans/ForgottenItemChecklist',
    component: ForgottenItemChecklist,
    tags: ['autodocs'],
    parameters: { layout: 'padded' },
} satisfies Meta<typeof ForgottenItemChecklist>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 全項目が未確認の状態（準備完了直後） */
export const Default: Story = {
    args: { planId: 'plan-1', items: unconfirmedItems },
};

/** 一部の項目のみ確認済みの状態 */
export const PartiallyConfirmed: Story = {
    args: {
        planId: 'plan-1',
        items: unconfirmedItems.map((item, index) => ({ ...item, isConfirmed: index < 2 })),
    },
};

/** 全項目確認済みで「忘れ物なし！」が表示される状態 */
export const AllConfirmed: Story = {
    args: {
        planId: 'plan-1',
        items: unconfirmedItems.map((item) => ({ ...item, isConfirmed: true })),
    },
};

/** 終了済み予定の閲覧時（readOnly）。チェックボックス・完了解除ボタンが操作不可になる */
export const ReadOnly: Story = {
    args: {
        planId: 'plan-1',
        items: unconfirmedItems.map((item, index) => ({ ...item, isConfirmed: index < 3 })),
        readOnly: true,
    },
};

/** 持ち物が 0 件のとき（進捗 0/0 表示） */
export const Empty: Story = {
    args: { planId: 'plan-1', items: [] },
};
