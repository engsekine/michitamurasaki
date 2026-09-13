import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { NextPlanList } from './NextPlanList';

const meta = {
    title: 'features/plans/NextPlanList',
    component: NextPlanList,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
    },
} satisfies Meta<typeof NextPlanList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        plans: [
            { id: '1', plannedOn: '2026-08-10', location: '真栄田岬（沖縄）', daysUntil: 3 },
            { id: '2', plannedOn: '2026-08-16', location: '大瀬崎（静岡）', daysUntil: 9 },
            { id: '3', plannedOn: '2026-08-22', location: '慶良間諸島（沖縄）', daysUntil: 15 },
            { id: '4', plannedOn: '2026-09-01', location: '柏島（高知）', daysUntil: 25 },
            { id: '5', plannedOn: '2026-09-05', location: '八丈島（東京）', daysUntil: 29 },
        ],
    },
};

export const SinglePlan: Story = {
    args: {
        plans: [{ id: '1', plannedOn: '2026-08-10', location: '真栄田岬（沖縄）', daysUntil: 3 }],
    },
};

export const IncludingToday: Story = {
    args: {
        plans: [
            { id: '1', plannedOn: '2026-08-07', location: '伊豆海洋公園（静岡）', daysUntil: 0 },
            { id: '2', plannedOn: '2026-08-16', location: '大瀬崎（静岡）', daysUntil: 9 },
        ],
    },
};

export const Empty: Story = {
    args: {
        plans: [],
    },
};
