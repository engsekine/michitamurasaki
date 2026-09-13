import { render, screen } from '@testing-library/react';

import { FollowCounts } from './FollowCounts';

const USER_ID = '22222222-2222-2222-2222-222222222222';

describe('FollowCounts', () => {
    it('件数と一覧ページへのリンクを表示する', () => {
        render(<FollowCounts userId={USER_ID} handle="buddy-taro" followingCount={3} followerCount={5} />);

        expect(screen.getByRole('link', { name: /3 フォロー中/ })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /5 フォロワー/ })).toBeInTheDocument();
    });

    it('handle があるとユーザー ID 基準のリンクになる（034 / FR-004）', () => {
        render(<FollowCounts userId={USER_ID} handle="buddy-taro" followingCount={0} followerCount={0} />);

        expect(screen.getByRole('link', { name: /フォロー中/ })).toHaveAttribute('href', '/users/buddy-taro/following');
        expect(screen.getByRole('link', { name: /フォロワー/ })).toHaveAttribute('href', '/users/buddy-taro/followers');
    });

    it('handle 未指定は内部 ID URL にフォールバックする', () => {
        render(<FollowCounts userId={USER_ID} followingCount={0} followerCount={0} />);

        expect(screen.getByRole('link', { name: /フォロー中/ })).toHaveAttribute('href', `/users/${USER_ID}/following`);
    });
});
