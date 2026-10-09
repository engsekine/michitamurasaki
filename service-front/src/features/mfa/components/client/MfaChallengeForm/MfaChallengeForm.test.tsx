import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const verifyLogin = vi.fn();

vi.mock('@/features/mfa/server/actions', () => ({
    verifyLogin: (...args: unknown[]) => verifyLogin(...args),
}));

import { MfaChallengeForm } from './MfaChallengeForm';

describe('MfaChallengeForm', () => {
    beforeEach(() => {
        verifyLogin.mockReset();
    });

    it('初期表示からコード入力欄を出す（TOTP は送信工程が無い）', () => {
        render(<MfaChallengeForm factorId="factor-1" />);

        expect(screen.getByLabelText(/確認コード/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /送信/ })).not.toBeInTheDocument();
    });

    it('コード入力後、verifyLogin を factorId / code で呼ぶ', async () => {
        verifyLogin.mockResolvedValueOnce({
            success: false,
            error: '確認コードが正しくありません。もう一度お試しください',
        });
        const user = userEvent.setup();
        render(<MfaChallengeForm factorId="factor-1" />);

        await user.type(screen.getByLabelText(/確認コード/), '123456');
        await user.click(screen.getByRole('button', { name: /ログインを完了する/ }));

        expect(verifyLogin).toHaveBeenCalledWith('factor-1', '123456');
        expect(await screen.findByRole('alert')).toHaveTextContent('確認コードが正しくありません');
    });

    it('桁数が不正ならサーバーを呼ばずにエラーを出す', async () => {
        const user = userEvent.setup();
        render(<MfaChallengeForm factorId="factor-1" />);

        await user.type(screen.getByLabelText(/確認コード/), '12');
        await user.click(screen.getByRole('button', { name: /ログインを完了する/ }));

        expect(await screen.findByRole('alert')).toHaveTextContent('6 桁の数字');
        expect(verifyLogin).not.toHaveBeenCalled();
    });
});
