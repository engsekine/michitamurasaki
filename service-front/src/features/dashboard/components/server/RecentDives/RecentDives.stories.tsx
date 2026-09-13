import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import type { RecentDiveItem } from '@/features/dashboard/types';

import { RecentDives } from './RecentDives';

const sampleDives: RecentDiveItem[] = [
    {
        id: 'dive-1',
        diveDate: '2026-05-20',
        location: '石垣島・米原',
        maxDepthM: 18.5,
        bottomTimeMin: 42,
        coverThumbUrl: 'https://picsum.photos/seed/dive1/400/225',
    },
    {
        id: 'dive-2',
        diveDate: '2026-05-19',
        location: '石垣島・崎枝',
        maxDepthM: 24,
        bottomTimeMin: 38,
        coverThumbUrl: null,
    },
    {
        id: 'dive-3',
        diveDate: '2026-05-18',
        location: '石垣島・マンタスクランブル',
        maxDepthM: 16,
        bottomTimeMin: 45,
        coverThumbUrl: 'https://picsum.photos/seed/dive3/400/225',
    },
];

const meta = {
    title: 'features/dashboard/RecentDives',
    component: RecentDives,
    tags: ['autodocs'],
    parameters: { layout: 'padded' },
} satisfies Meta<typeof RecentDives>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 複数件（最大 3 件・3 カラム。写真あり / なし混在） */
export const Default: Story = {
    args: { dives: sampleDives },
};

/** 0 件（最初のログを記録しよう CTA） */
export const Empty: Story = {
    args: { dives: [] },
};

/** 全件写真なし（ロゴのダミー画像にフォールバック） */
export const NoPhotos: Story = {
    args: {
        dives: sampleDives.map((dive) => ({ ...dive, coverThumbUrl: null })),
    },
};

/** 新月直後の日付（2000-01-07）で「大潮」ラベルが付くケース */
export const SpringTide: Story = {
    args: {
        dives: [
            {
                id: 'dive-1',
                diveDate: '2000-01-07',
                location: '石垣島・米原',
                maxDepthM: 18.5,
                bottomTimeMin: 42,
                coverThumbUrl: null,
            },
        ],
    },
};
