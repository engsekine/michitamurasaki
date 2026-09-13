import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const signIn = vi.fn();

vi.mock('@/features/auth/server/actions', () => ({
    signIn: (...args: unknown[]) => signIn(...args),
    signInWithGoogle: vi.fn(),
}));

import { LoginForm } from './LoginForm';

describe('LoginForm', () => {
    beforeEach(() => {
        signIn.mockReset();
    });

    it('メールアドレス・パスワード入力欄を表示する', () => {
        render(<LoginForm />);

        expect(screen.getByLabelText('メールアドレス')).toBeInTheDocument();
        expect(screen.getByLabelText('パスワード')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'ログイン' })).toBeInTheDocument();
    });

    it('「新規登録はこちら」「パスワードを忘れた方」のリンクを表示する', () => {
        render(<LoginForm />);

        expect(screen.getByRole('link', { name: '新規登録はこちら' })).toHaveAttribute('href', '/signup');
        expect(screen.getByRole('link', { name: 'パスワードを忘れた方' })).toHaveAttribute('href', '/reset-password');
    });

    it('未入力で送信するとバリデーションエラーが alert ロールで表示される', async () => {
        const user = userEvent.setup();
        render(<LoginForm />);

        await user.click(screen.getByRole('button', { name: 'ログイン' }));

        const alerts = await screen.findAllByRole('alert');
        expect(alerts.length).toBeGreaterThan(0);
        expect(signIn).not.toHaveBeenCalled();
    });

    it('signIn がエラーを返すと root エラーが表示される', async () => {
        signIn.mockResolvedValueOnce({ success: false, error: 'メールアドレスまたはパスワードが正しくありません' });
        const user = userEvent.setup();
        render(<LoginForm />);

        await user.type(screen.getByLabelText('メールアドレス'), 'user@example.com');
        await user.type(screen.getByLabelText('パスワード'), 'password123');
        await user.click(screen.getByRole('button', { name: 'ログイン' }));

        expect(await screen.findByText('メールアドレスまたはパスワードが正しくありません')).toBeInTheDocument();
    });
});
