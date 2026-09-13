import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import type { LikedDivesCursor, TimelineItem } from '@/features/social/types';
import { LikedDivesList } from './LikedDivesList';

const item = (id: string, diveDate: string, location: string, ownerNickname: string, likeCount = 1): TimelineItem => ({
    diveId: id,
    diveDate,
    location,
    maxDepthM: 18.5,
    bottomTimeMin: 42,
    ownerId: `owner-${id}`,
    ownerNickname,
    likeCount,
    likedByMe: true,
});

const cursor: LikedDivesCursor = {
    likedAt: '2026-06-28T12:00:00+09:00',
    diveId: 'dive-3',
};

const meta = {
    title: 'features/social/LikedDivesList',
    component: LikedDivesList,
    tags: ['autodocs'],
    parameters: { layout: 'padded' },
} satisfies Meta<typeof LikedDivesList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** いいねしたログが 0 件のとき: 空状態メッセージを表示する */
export const Empty: Story = {
    args: {
        initialItems: [],
        initialCursor: null,
    },
};

/** 3 件表示・次ページなし: 「さらに読み込む」ボタンは非表示 */
export const WithItems: Story = {
    args: {
        initialItems: [
            item('1', '2026-06-30', '伊豆 / 大瀬崎', 'たろう', 5),
            item('2', '2026-06-28', '串本 / 住崎', 'はなこ', 2),
            item('3', '2026-06-25', '宮古島 / 通り池', 'じろう', 8),
        ],
        initialCursor: null,
    },
};

/** 3 件表示・cursor あり: 「さらに読み込む」ボタンが表示される */
export const WithMorePages: Story = {
    args: {
        initialItems: [
            item('1', '2026-06-30', '伊豆 / 大瀬崎', 'たろう', 5),
            item('2', '2026-06-28', '串本 / 住崎', 'はなこ', 2),
            item('3', '2026-06-25', '宮古島 / 通り池', 'じろう', 8),
        ],
        initialCursor: cursor,
    },
};
