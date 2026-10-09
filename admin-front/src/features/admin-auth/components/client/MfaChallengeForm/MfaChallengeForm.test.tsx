import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MfaChallengeForm } from './MfaChallengeForm';

const { verifyAdminLogin } = vi.hoisted(() => ({
    verifyAdminLogin: vi.fn(),
}));

vi.mock('@/features/admin-auth/server/mfaActions', () => ({ verifyAdminLogin }));

describe('MfaChallengeForm', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('初期表示からコード入力欄を出す（TOTP は送信工程が無い）', () => {
        render(<MfaChallengeForm factorId="factor-1" />);

        expect(screen.getByLabelText(/確認コード/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /送信/ })).not.toBeInTheDocument();
    });

    it('6 桁を入力すると verifyAdminLogin を factorId / code で呼ぶ', async () => {
        verifyAdminLogin.mockResolvedValue({
            success: false,
            error: '確認コードが正しくありません。もう一度お試しください',
        });

        render(<MfaChallengeForm factorId="factor-1" />);

        fireEvent.change(screen.getByLabelText(/確認コード/), { target: { value: '123456' } });
        fireEvent.click(screen.getByRole('button', { name: 'ログインを完了する' }));

        await waitFor(() => expect(verifyAdminLogin).toHaveBeenCalledWith('factor-1', '123456'));
        expect(await screen.findByRole('alert')).toHaveTextContent('確認コードが正しくありません');
    });

    it('桁数が不正ならサーバーを呼ばずにエラーを出す', async () => {
        render(<MfaChallengeForm factorId="factor-1" />);

        fireEvent.change(screen.getByLabelText(/確認コード/), { target: { value: '12' } });
        fireEvent.click(screen.getByRole('button', { name: 'ログインを完了する' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('6 桁の数字を入力してください');
        expect(verifyAdminLogin).not.toHaveBeenCalled();
    });
});
