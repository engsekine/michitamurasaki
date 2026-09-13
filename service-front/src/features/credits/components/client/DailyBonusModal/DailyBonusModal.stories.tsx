import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { DailyBonusModal } from './DailyBonusModal';

const meta = {
    title: 'features/credits/DailyBonusModal',
    component: DailyBonusModal,
    tags: ['autodocs'],
    parameters: { layout: 'centered' },
} satisfies Meta<typeof DailyBonusModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 既定表示。デイリーボーナス獲得の通知と付与後の残り枠数を表示する */
export const Default: Story = {
    args: { remainingCredits: 12 },
};

/** 残枠の取得に失敗したケース。枠数表示のみ省略し、獲得の事実は伝える */
export const WithoutRemainingCredits: Story = {
    args: { remainingCredits: null },
};
