import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ApplicationSheetForm } from './ApplicationSheetForm';

const meta = {
    title: 'features/application-sheet/ApplicationSheetForm',
    component: ApplicationSheetForm,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        nextjs: {
            appDirectory: true,
            navigation: { pathname: '/application-sheet' },
        },
    },
} satisfies Meta<typeof ApplicationSheetForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
    args: {},
};

export const Prefilled: Story = {
    args: {
        defaultValues: {
            fullName: '山田 太郎',
            age: '36',
            birthOn: '1990-05-03',
            gender: 'male',
            licenseRank: 'Open Water Diver',
            diveCount: '52',
            lastDiveYearMonth: '2026-05',
            heightCm: '172.5',
            weightKg: '65',
        },
    },
};
