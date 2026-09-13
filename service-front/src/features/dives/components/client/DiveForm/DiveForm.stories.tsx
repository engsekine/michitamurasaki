import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DiveForm } from './DiveForm';

const meta = {
    title: 'features/dives/DiveForm',
    component: DiveForm,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        nextjs: {
            appDirectory: true,
            navigation: { pathname: '/dives/new' },
        },
    },
} satisfies Meta<typeof DiveForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NewMode: Story = {};

/** 予定→ログ移動（024）: 予定の予定日・ポイント名・メモを初期値として引き継いだ新規作成フォーム */
export const MoveFromPlan: Story = {
    args: {
        fromPlanId: 'plan-1',
        defaultValues: {
            diveDate: '2026-06-30',
            location: '伊豆 / 大瀬崎',
            notes: '外洋狙い。ドライスーツ。',
        },
    },
};

export const EditMode: Story = {
    args: {
        diveId: 'sample-id',
        defaultValues: {
            diveNumber: 42,
            diveDate: '2026-04-15',
            location: '伊豆 / 大瀬崎',
            maxDepthM: 22.5,
            bottomTimeMin: 48,
            waterTempC: 18.2,
            visibilityM: 12,
        },
    },
};

/**
 * 残枠 0 の新規作成（026 / FR-002）。
 * フォーム先頭に NoCreditBanner を先行表示する（送信自体はサーバー側が最終判定）。
 */
export const NoCredit: Story = {
    args: {
        creditBalance: 0,
    },
};
