import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { followUser, unfollowUser } from '@/features/social/server/actions';
import { FollowButton } from './FollowButton';

vi.mock('@/features/social/server/actions', () => ({
    followUser: vi.fn(),
    unfollowUser: vi.fn(),
}));

const mockedFollow = vi.mocked(followUser);
const mockedUnfollow = vi.mocked(unfollowUser);

describe('FollowButton', () => {
    beforeEach(() => {
        mockedFollow.mockReset();
        mockedUnfollow.mockReset();
    });

    it('未フォロー時は「フォロー」を aria-pressed=false で表示する', () => {
        render(<FollowButton targetUserId="u1" initialIsFollowing={false} />);
        const button = screen.getByRole('button', { name: 'フォロー' });
        expect(button).toHaveAttribute('aria-pressed', 'false');
    });

    it('クリックで followUser を呼び、フォロー中になる', async () => {
        mockedFollow.mockResolvedValue({ success: true, isFollowing: true });
        const user = userEvent.setup();
        render(<FollowButton targetUserId="u1" initialIsFollowing={false} />);

        await user.click(screen.getByRole('button', { name: 'フォロー' }));

        expect(mockedFollow).toHaveBeenCalledWith('u1');
        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'フォロー中' })).toHaveAttribute('aria-pressed', 'true'),
        );
    });

    it('フォロー中にクリックすると unfollowUser を呼び、未フォローになる', async () => {
        mockedUnfollow.mockResolvedValue({ success: true, isFollowing: false });
        const user = userEvent.setup();
        render(<FollowButton targetUserId="u1" initialIsFollowing />);

        await user.click(screen.getByRole('button', { name: 'フォロー中' }));

        expect(mockedUnfollow).toHaveBeenCalledWith('u1');
        await waitFor(() => expect(screen.getByRole('button', { name: 'フォロー' })).toBeInTheDocument());
    });

    it('失敗時は role="alert" で通知し状態を保つ', async () => {
        mockedFollow.mockResolvedValue({ success: false, error: 'フォローに失敗しました' });
        const user = userEvent.setup();
        render(<FollowButton targetUserId="u1" initialIsFollowing={false} />);

        await user.click(screen.getByRole('button', { name: 'フォロー' }));

        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('フォローに失敗しました'));
        expect(screen.getByRole('button', { name: 'フォロー' })).toHaveAttribute('aria-pressed', 'false');
    });
});
