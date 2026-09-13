import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const updatePassword = vi.fn();

vi.mock('@/features/auth/server/actions', () => ({
    updatePassword: (...args: unknown[]) => updatePassword(...args),
}));

import { UpdatePasswordForm } from './UpdatePasswordForm';

/** 要件を満たすパスワード（12 文字以上・英大小 + 数字） */
const VALID_PASSWORD = 'NewPassword123';

describe('UpdatePasswordForm', () => {
    beforeEach(() => {
        updatePassword.mockReset();
    });

    it('パスワード 2 欄と設定ボタンを表示する', () => {
        render(<UpdatePasswordForm />);

        expect(screen.getByLabelText('新しいパスワード')).toBeInTheDocument();
        expect(screen.getByLabelText('新しいパスワード（確認）')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'パスワードを設定する' })).toBeInTheDocument();
    });

    it('要件を満たす入力で updatePassword を呼ぶ', async () => {
        updatePassword.mockResolvedValue({ success: true });
        const user = userEvent.setup();
        render(<UpdatePasswordForm />);

        await user.type(screen.getByLabelText('新しいパスワード'), VALID_PASSWORD);
        await user.type(screen.getByLabelText('新しいパスワード（確認）'), VALID_PASSWORD);
        await user.click(screen.getByRole('button', { name: 'パスワードを設定する' }));

        await waitFor(() => {
            expect(updatePassword).toHaveBeenCalledWith(VALID_PASSWORD);
        });
    });

    it('確認用パスワードが一致しない場合は送信しない', async () => {
        const user = userEvent.setup();
        render(<UpdatePasswordForm />);

        await user.type(screen.getByLabelText('新しいパスワード'), VALID_PASSWORD);
        await user.type(screen.getByLabelText('新しいパスワード（確認）'), 'Different1234');
        await user.click(screen.getByRole('button', { name: 'パスワードを設定する' }));

        expect(await screen.findByText('パスワードが一致しません')).toBeInTheDocument();
        expect(updatePassword).not.toHaveBeenCalled();
    });

    it('要件未満のパスワードはクライアント側で拒否する', async () => {
        const user = userEvent.setup();
        render(<UpdatePasswordForm />);

        await user.type(screen.getByLabelText('新しいパスワード'), 'short');
        await user.type(screen.getByLabelText('新しいパスワード（確認）'), 'short');
        await user.click(screen.getByRole('button', { name: 'パスワードを設定する' }));

        expect(await screen.findByText('パスワードは12文字以上で入力してください')).toBeInTheDocument();
        expect(updatePassword).not.toHaveBeenCalled();
    });

    it('サーバーアクションの失敗を role="alert" で表示する', async () => {
        updatePassword.mockResolvedValue({
            success: false,
            error: '現在と同じパスワードは設定できません。別のパスワードを入力してください',
        });
        const user = userEvent.setup();
        render(<UpdatePasswordForm />);

        await user.type(screen.getByLabelText('新しいパスワード'), VALID_PASSWORD);
        await user.type(screen.getByLabelText('新しいパスワード（確認）'), VALID_PASSWORD);
        await user.click(screen.getByRole('button', { name: 'パスワードを設定する' }));

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('現在と同じパスワードは設定できません。別のパスワードを入力してください');
    });
});
