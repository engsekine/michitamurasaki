import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SavedSheetList } from './SavedSheetList';

const meta = {
    title: 'features/application-sheet/SavedSheetList',
    component: SavedSheetList,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        nextjs: {
            appDirectory: true,
            navigation: { pathname: '/application-sheet' },
        },
    },
} satisfies Meta<typeof SavedSheetList>;

export default meta;
type Story = StoryObj<typeof meta>;

const SAMPLE_SHEETS = [
    { id: 'sheet-2', name: '伊豆のショップ用', updatedAt: '2026-07-11T02:30:00Z' },
    { id: 'sheet-1', name: '沖縄ツアー用', updatedAt: '2026-07-10T01:00:00Z' },
];

export const Default: Story = {
    args: {
        sheets: SAMPLE_SHEETS,
        selectedSheetId: null,
    },
};

export const WithSelection: Story = {
    args: {
        sheets: SAMPLE_SHEETS,
        selectedSheetId: 'sheet-2',
    },
};
