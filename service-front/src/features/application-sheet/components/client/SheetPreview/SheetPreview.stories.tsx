import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SheetPreview } from './SheetPreview';

const meta = {
    title: 'features/application-sheet/SheetPreview',
    component: SheetPreview,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
    },
} satisfies Meta<typeof SheetPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

const SAMPLE_TEXT = [
    '・お名前（山田 太郎）',
    '・年齢（36 歳）',
    '・生年月日（西暦 1990 年 5 月 3 日）',
    '・性別（男性）',
    '・携帯電話（090-1234-5678）',
].join('\n');

export const Default: Story = {
    args: {
        generatedText: SAMPLE_TEXT,
    },
};

export const EmptyValues: Story = {
    args: {
        generatedText: '・お名前（ ）\n・年齢（ 歳）\n・性別（ ）',
    },
};
