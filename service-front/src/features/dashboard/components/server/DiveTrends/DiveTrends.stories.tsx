import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import type { MonthlyDiveStat } from '@/features/dashboard/types';

import { DiveTrends } from './DiveTrends';

const months = [
    '2025-07',
    '2025-08',
    '2025-09',
    '2025-10',
    '2025-11',
    '2025-12',
    '2026-01',
    '2026-02',
    '2026-03',
    '2026-04',
    '2026-05',
    '2026-06',
];

const emptyMonthly: MonthlyDiveStat[] = months.map((month) => ({
    month,
    diveCount: 0,
}));

const sampleMonthly: MonthlyDiveStat[] = months.map((month, index) => ({
    month,
    diveCount: [2, 5, 3, 1, 0, 0, 0, 2, 1, 3, 4, 6][index] ?? 0,
}));

const meta = {
    title: 'features/dashboard/DiveTrends',
    component: DiveTrends,
    tags: ['autodocs'],
    parameters: { layout: 'padded' },
} satisfies Meta<typeof DiveTrends>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 通常（複数年・複数月のログあり） */
export const Default: Story = {
    args: {
        yearlyCounts: [
            { year: 2024, diveCount: 18 },
            { year: 2025, diveCount: 24 },
            { year: 2026, diveCount: 11 },
        ],
        monthlyStats: sampleMonthly,
    },
};

/** ログはあるが直近 12 ヶ月は 0 本（research.md R-006: 空状態にしない） */
export const NoRecentDives: Story = {
    args: {
        yearlyCounts: [{ year: 2023, diveCount: 9 }],
        monthlyStats: emptyMonthly,
    },
};

/** ログ 0 件（空状態 + 記録 CTA — FR-007） */
export const Empty: Story = {
    args: {
        yearlyCounts: [],
        monthlyStats: emptyMonthly,
    },
};

/** 集計失敗 */
export const Failed: Story = {
    args: {
        yearlyCounts: null,
        monthlyStats: null,
    },
};
