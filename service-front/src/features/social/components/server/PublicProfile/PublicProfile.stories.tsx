import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import type { PublicProfile as PublicProfileData, TimelineItem } from '@/features/social/types';

import { PublicProfile } from './PublicProfile';

const baseProfile: PublicProfileData = {
    userId: 'user-1',
    nickname: 'たろう',
    handle: 'taro',
    followState: { isFollowing: false, followerCount: 12, followingCount: 8 },
};

const publicDives: TimelineItem[] = [
    {
        diveId: 'dive-1',
        diveDate: '2026-04-15',
        location: '伊豆 / 大瀬崎',
        maxDepthM: 22.5,
        bottomTimeMin: 48,
        ownerId: 'user-1',
        ownerNickname: 'たろう',
        ownerHandle: 'taro',
        likeCount: 3,
        likedByMe: false,
    },
];

const meta = {
    title: 'features/social/PublicProfile',
    component: PublicProfile,
    tags: ['autodocs'],
    parameters: { layout: 'padded' },
} satisfies Meta<typeof PublicProfile>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 他人のプロフィール。フォローボタンと SNS 共有ボタン（spec 035）を表示する */
export const OtherUser: Story = {
    args: { profile: baseProfile, publicDives, isSelf: false },
};

/** 自分のプロフィール。フォローボタンは出ないが SNS 共有ボタンは表示される */
export const Self: Story = {
    args: { profile: baseProfile, publicDives: [], isSelf: true },
};
