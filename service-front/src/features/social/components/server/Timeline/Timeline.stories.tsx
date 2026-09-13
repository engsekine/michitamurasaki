import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { TimelineItem } from '@/features/social/types';
import { Timeline } from './Timeline';

const item = (
    id: string,
    diveDate: string,
    location: string,
    ownerNickname: string,
    like: { likeCount?: number; likedByMe?: boolean } = {},
): TimelineItem => ({
    diveId: id,
    diveDate,
    location,
    maxDepthM: 18.5,
    bottomTimeMin: 42,
    ownerId: `owner-${id}`,
    ownerNickname,
    likeCount: like.likeCount ?? 0,
    likedByMe: like.likedByMe ?? false,
});

const meta = {
    title: 'features/social/Timeline',
    component: Timeline,
    tags: ['autodocs'],
    parameters: { layout: 'padded' },
} satisfies Meta<typeof Timeline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
    args: { items: [] },
};

export const WithItems: Story = {
    args: {
        items: [
            item('1', '2026-06-30', '伊豆 / 大瀬崎', 'たろう'),
            item('2', '2026-06-30', '串本 / 住崎', 'はなこ'),
            item('3', '2026-06-28', '宮古島 / 通り池', 'たろう'),
        ],
    },
};

// 閲覧者あり: 他人のログにいいねボタン（いいね済み・未いいね）が並ぶ
export const WithLikes: Story = {
    args: {
        viewerId: 'viewer-1',
        items: [
            item('1', '2026-06-30', '伊豆 / 大瀬崎', 'たろう', { likeCount: 3, likedByMe: true }),
            item('2', '2026-06-30', '串本 / 住崎', 'はなこ', { likeCount: 0 }),
        ],
    },
};
