import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import type { NextPlanSummary, PackingItem } from '@/features/plans/types';

import { NextPlanCardView } from './NextPlanCardView';

const basePackingItems: PackingItem[] = [
    { id: 'item-1', name: 'マスク', isChecked: true, isConfirmed: false, position: 0 },
    { id: 'item-2', name: 'フィン', isChecked: true, isConfirmed: false, position: 1 },
    { id: 'item-3', name: 'ログブック', isChecked: false, isConfirmed: false, position: 2 },
    { id: 'item-4', name: 'シュノーケル', isChecked: false, isConfirmed: false, position: 3 },
    { id: 'item-5', name: 'ウェットスーツ', isChecked: false, isConfirmed: false, position: 4 },
];

const baseSummary: NextPlanSummary = {
    id: 'plan-1',
    plannedOn: '2026-06-20',
    location: '沖縄 / 青の洞窟',
    notes: '夏の遠征。ボートダイブ予定。',
    daysUntil: 9,
    packingItems: basePackingItems,
    packingCompletedAt: null,
};

const meta = {
    title: 'features/plans/NextPlanCard',
    component: NextPlanCardView,
    tags: ['autodocs'],
    parameters: { layout: 'padded' },
} satisfies Meta<typeof NextPlanCardView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 予定あり（未来の予定 + 持ち物準備中） */
export const Default: Story = { args: { summary: baseSummary } };

/** 予定なし（計画 CTA を表示） */
export const Empty: Story = { args: { summary: null } };

/** 予定日が今日（バッジが「今日」になる） */
export const Today: Story = {
    args: { summary: { ...baseSummary, daysUntil: 0 } },
};

/** hero バリアント（TOP の FV・写真背景上のすりガラス配色）。背景を暗くして視認性を再現する */
export const Hero: Story = {
    args: { summary: { ...baseSummary, daysUntil: 0 }, variant: 'hero' },
    decorators: [
        (StoryComponent) => (
            <div className="bg-[oklch(0.28_0.08_255)] p-6">
                <StoryComponent />
            </div>
        ),
    ],
};

/** 持ち物が全件チェック済み */
export const AllPacked: Story = {
    args: {
        summary: {
            ...baseSummary,
            packingItems: basePackingItems.map((item) => ({ ...item, isChecked: true })),
        },
    },
};

/** 持ち物が多い（リストがスクロールする） */
export const ManyItems: Story = {
    args: {
        summary: {
            ...baseSummary,
            packingItems: Array.from({ length: 12 }, (_, index) => ({
                id: `item-${index + 1}`,
                name: `持ち物${index + 1}`,
                isChecked: index < 4,
                position: index,
            })),
        },
    },
};

/** メモなし（メモ行が非表示になる） */
export const WithoutNotes: Story = {
    args: { summary: { ...baseSummary, notes: null } },
};
