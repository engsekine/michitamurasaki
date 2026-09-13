import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push }),
    useSearchParams: () => new URLSearchParams(''),
}));

import { UserSearchBar } from './UserSearchBar';

beforeEach(() => {
    push.mockClear();
});

describe('UserSearchBar', () => {
    it('検索フォーム（入力欄と送信ボタン）を表示する', () => {
        render(<UserSearchBar />);
        expect(screen.getByRole('searchbox', { name: 'ユーザーIDで探す' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '検索' })).toBeInTheDocument();
    });

    it('入力して送信すると /users/search?q=... へ遷移する', async () => {
        const user = userEvent.setup();
        render(<UserSearchBar />);

        await user.type(screen.getByRole('searchbox', { name: 'ユーザーIDで探す' }), 'taro');
        await user.click(screen.getByRole('button', { name: '検索' }));

        expect(push).toHaveBeenCalledWith('/users/search?q=taro');
    });

    it('前後の空白は trim して遷移する', async () => {
        const user = userEvent.setup();
        render(<UserSearchBar />);

        await user.type(screen.getByRole('searchbox', { name: 'ユーザーIDで探す' }), '  taro  ');
        await user.click(screen.getByRole('button', { name: '検索' }));

        expect(push).toHaveBeenCalledWith('/users/search?q=taro');
    });

    it('空入力で送信するとクエリ無しの /users/search へ遷移する', async () => {
        const user = userEvent.setup();
        render(<UserSearchBar />);

        await user.click(screen.getByRole('button', { name: '検索' }));

        expect(push).toHaveBeenCalledWith('/users/search');
    });
});
