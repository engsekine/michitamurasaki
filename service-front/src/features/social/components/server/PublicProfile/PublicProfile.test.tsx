import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import type { PublicProfile as PublicProfileData } from '@/features/social/types';
import { SITE_NAME, SITE_URL } from '@/shared/constants/site';

import { PublicProfile } from './PublicProfile';

// フォローボタンは Server Action に依存するためモックする（挙動は FollowButton 側でテスト済み）
vi.mock('../../client/FollowButton', () => ({
    FollowButton: () => <button type="button">フォロー</button>,
}));

const baseProfile: PublicProfileData = {
    userId: 'user-1',
    nickname: 'たろう',
    handle: 'taro',
    followState: { isFollowing: false, followerCount: 2, followingCount: 3 },
};

describe('PublicProfile', () => {
    it('ニックネームを見出しとして表示する', () => {
        render(<PublicProfile profile={baseProfile} publicDives={[]} isSelf={false} />);
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('たろう');
    });

    it('SNS 共有ボタンを表示し、handle ベースのプロフィール URL とテキストを渡す（spec 035 FR-002/006/007）', () => {
        render(<PublicProfile profile={baseProfile} publicDives={[]} isSelf={false} />);

        const xLink = screen.getByRole('link', { name: 'X で共有' });
        const params = new URL(xLink.getAttribute('href') ?? '').searchParams;
        expect(params.get('url')).toBe(`${SITE_URL}/users/taro`);
        expect(params.get('text')).toBe(`たろうのダイビングプロフィール | ${SITE_NAME}`);
        expect(screen.getByRole('link', { name: 'Facebook で共有' })).toBeInTheDocument();
    });

    it('自分のプロフィール（isSelf）でも SNS 共有ボタンを表示する', () => {
        render(<PublicProfile profile={baseProfile} publicDives={[]} isSelf />);
        expect(screen.getByRole('link', { name: 'X で共有' })).toBeInTheDocument();
        // 自分にはフォローボタンは出ない（既存仕様の回帰確認）
        expect(screen.queryByRole('button', { name: 'フォロー' })).not.toBeInTheDocument();
    });
});
