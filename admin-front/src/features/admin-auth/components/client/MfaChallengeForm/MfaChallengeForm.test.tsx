import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MfaChallengeForm } from './MfaChallengeForm';

const { challengeAdminLoginFactor, verifyAdminLogin } = vi.hoisted(() => ({
    challengeAdminLoginFactor: vi.fn(),
    verifyAdminLogin: vi.fn(),
}));

vi.mock('@/features/admin-auth/server/mfaActions', () => ({ challengeAdminLoginFactor, verifyAdminLogin }));

describe('MfaChallengeForm', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('初期表示は送信ボタンのみで、コード入力欄は出さない', () => {
        render(<MfaChallengeForm factorId="factor-1" />);

        expect(screen.getByRole('button', { name: 'SMS で確認コードを送信する' })).toBeInTheDocument();
        expect(screen.queryByLabelText(/確認コード/)).not.toBeInTheDocument();
    });

    it('送信成功でコード入力欄が出て、6 桁を入力すると verifyAdminLogin を呼ぶ', async () => {
        challengeAdminLoginFactor.mockResolvedValue({ success: true, challengeId: 'challenge-1' });
        verifyAdminLogin.mockResolvedValue({
            success: false,
            error: '確認コードが正しくありません。もう一度お試しください',
        });

        render(<MfaChallengeForm factorId="factor-1" />);

        fireEvent.click(screen.getByRole('button', { name: 'SMS で確認コードを送信する' }));
        await waitFor(() => expect(challengeAdminLoginFactor).toHaveBeenCalledWith('factor-1'));

        fireEvent.change(await screen.findByLabelText(/確認コード/), { target: { value: '123456' } });
        fireEvent.click(screen.getByRole('button', { name: 'ログインを完了する' }));

        await waitFor(() => expect(verifyAdminLogin).toHaveBeenCalledWith('factor-1', 'challenge-1', '123456'));
        expect(await screen.findByRole('alert')).toHaveTextContent('確認コードが正しくありません');
    });

    it('桁数が不正ならサーバーを呼ばずにエラーを出す', async () => {
        challengeAdminLoginFactor.mockResolvedValue({ success: true, challengeId: 'challenge-1' });

        render(<MfaChallengeForm factorId="factor-1" />);

        fireEvent.click(screen.getByRole('button', { name: 'SMS で確認コードを送信する' }));
        fireEvent.change(await screen.findByLabelText(/確認コード/), { target: { value: '12' } });
        fireEvent.click(screen.getByRole('button', { name: 'ログインを完了する' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('6 桁の数字を入力してください');
        expect(verifyAdminLogin).not.toHaveBeenCalled();
    });

    it('送信失敗時はエラーメッセージを表示する', async () => {
        challengeAdminLoginFactor.mockResolvedValue({ success: false, error: '確認コードの送信に失敗しました' });

        render(<MfaChallengeForm factorId="factor-1" />);

        fireEvent.click(screen.getByRole('button', { name: 'SMS で確認コードを送信する' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('確認コードの送信に失敗しました');
    });
});
