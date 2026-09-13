import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const signInWithGoogle = vi.fn();

vi.mock('@/features/auth/server/actions', () => ({
    signInWithGoogle: (...args: unknown[]) => signInWithGoogle(...args),
}));

import { GoogleAuthButton } from './GoogleAuthButton';

describe('GoogleAuthButton', () => {
    beforeEach(() => {
        signInWithGoogle.mockReset();
    });

    it('既定で「Google でログイン」ボタンを表示する', () => {
        render(<GoogleAuthButton />);
        expect(screen.getByRole('button', { name: /Google でログイン/ })).toBeInTheDocument();
    });

    it('label を渡すとその文言を表示する', () => {
        render(<GoogleAuthButton label="Google で続行" />);
        expect(screen.getByRole('button', { name: /Google で続行/ })).toBeInTheDocument();
    });

    it('クリックすると signInWithGoogle を呼ぶ', async () => {
        signInWithGoogle.mockResolvedValueOnce({ success: true });
        const user = userEvent.setup();
        render(<GoogleAuthButton />);

        await user.click(screen.getByRole('button', { name: /Google でログイン/ }));

        expect(signInWithGoogle).toHaveBeenCalledTimes(1);
    });

    it('開始に失敗するとエラーが alert ロールで表示される', async () => {
        signInWithGoogle.mockResolvedValueOnce({ success: false, error: 'Google ログインを開始できませんでした' });
        const user = userEvent.setup();
        render(<GoogleAuthButton />);

        await user.click(screen.getByRole('button', { name: /Google でログイン/ }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Google ログインを開始できませんでした');
    });
});
