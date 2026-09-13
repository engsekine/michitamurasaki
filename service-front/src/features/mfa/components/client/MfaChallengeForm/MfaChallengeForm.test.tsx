import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const challengeLoginFactor = vi.fn();
const verifyLogin = vi.fn();

vi.mock('@/features/mfa/server/actions', () => ({
    challengeLoginFactor: (...args: unknown[]) => challengeLoginFactor(...args),
    verifyLogin: (...args: unknown[]) => verifyLogin(...args),
}));

import { MfaChallengeForm } from './MfaChallengeForm';

describe('MfaChallengeForm', () => {
    beforeEach(() => {
        challengeLoginFactor.mockReset();
        verifyLogin.mockReset();
    });

    it('最初は送信ボタンのみ。送信で challengeLoginFactor を呼びコード入力欄を出す', async () => {
        challengeLoginFactor.mockResolvedValueOnce({ success: true, challengeId: 'challenge-1' });
        const user = userEvent.setup();
        render(<MfaChallengeForm factorId="factor-1" />);

        expect(screen.queryByLabelText(/確認コード/)).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: /SMS で確認コードを送信する/ }));

        expect(challengeLoginFactor).toHaveBeenCalledWith('factor-1');
        expect(await screen.findByLabelText(/確認コード/)).toBeInTheDocument();
    });

    it('コード入力後、verifyLogin を factorId / challengeId / code で呼ぶ', async () => {
        challengeLoginFactor.mockResolvedValueOnce({ success: true, challengeId: 'challenge-1' });
        verifyLogin.mockResolvedValueOnce({
            success: false,
            error: '確認コードが正しくありません。もう一度お試しください',
        });
        const user = userEvent.setup();
        render(<MfaChallengeForm factorId="factor-1" />);

        await user.click(screen.getByRole('button', { name: /SMS で確認コードを送信する/ }));
        await user.type(await screen.findByLabelText(/確認コード/), '123456');
        await user.click(screen.getByRole('button', { name: /ログインを完了する/ }));

        expect(verifyLogin).toHaveBeenCalledWith('factor-1', 'challenge-1', '123456');
        expect(await screen.findByRole('alert')).toHaveTextContent('確認コードが正しくありません');
    });

    it('送信失敗（レート制限等）はエラーを表示する', async () => {
        challengeLoginFactor.mockResolvedValueOnce({
            success: false,
            error: '確認コードの再送は、しばらく時間をおいてからお試しください',
        });
        const user = userEvent.setup();
        render(<MfaChallengeForm factorId="factor-1" />);

        await user.click(screen.getByRole('button', { name: /SMS で確認コードを送信する/ }));

        expect(await screen.findByRole('alert')).toHaveTextContent('しばらく時間をおいて');
    });
});
