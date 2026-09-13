import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { RecordOverhaulButton } from './RecordOverhaulButton';

const meta = {
    title: 'features/dashboard/RecordOverhaulButton',
    component: RecordOverhaulButton,
    tags: ['autodocs'],
    parameters: { layout: 'padded' },
} satisfies Meta<typeof RecordOverhaulButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 記録成功（ダイアログで OK すると成功して閉じる） */
export const Default: Story = {
    args: {
        regulatorId: 'reg-1',
        onRecord: async () => ({ success: true as const }),
    },
};

/** 記録失敗（ダイアログを閉じてトリガー横に role="alert" のエラーを表示） */
export const RecordFailure: Story = {
    args: {
        regulatorId: 'reg-1',
        onRecord: async () => ({ success: false as const, error: 'メンテ完了の記録に失敗しました' }),
    },
};
