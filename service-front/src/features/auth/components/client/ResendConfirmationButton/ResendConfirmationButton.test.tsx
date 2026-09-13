import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const resendConfirmationEmail = vi.fn();

vi.mock('@/features/auth/server/actions', () => ({
    resendConfirmationEmail: (...args: unknown[]) => resendConfirmationEmail(...args),
}));

import { ResendConfirmationButton } from './ResendConfirmationButton';

describe('ResendConfirmationButton', () => {
    beforeEach(() => {
        resendConfirmationEmail.mockReset();
    });

    it('email が渡されるとメール入力欄を出さず、クリックで再送アクションをその宛先で呼ぶ', async () => {
        resendConfirmationEmail.mockResolvedValueOnce({ success: true });
        const user = userEvent.setup();
        render(<ResendConfirmationButton email="user@example.com" />);

        expect(screen.queryByLabelText('メールアドレス')).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: /確認メールを再送する/ }));

        expect(resendConfirmationEmail).toHaveBeenCalledWith('user@example.com');
    });

    it('再送成功後は成功メッセージを表示し、クールダウンでボタンを無効化する', async () => {
        resendConfirmationEmail.mockResolvedValueOnce({ success: true });
        const user = userEvent.setup();
        render(<ResendConfirmationButton email="user@example.com" />);

        await user.click(screen.getByRole('button', { name: /確認メールを再送する/ }));

        expect(await screen.findByText('確認メールを再送しました。メールをご確認ください。')).toBeInTheDocument();
        expect(screen.getByRole('button')).toBeDisabled();
    });

    it('失敗するとエラーが alert ロールで表示される', async () => {
        resendConfirmationEmail.mockResolvedValueOnce({
            success: false,
            error: '確認メールの再送は、しばらく時間をおいてから再度お試しください',
        });
        const user = userEvent.setup();
        render(<ResendConfirmationButton email="user@example.com" />);

        await user.click(screen.getByRole('button', { name: /確認メールを再送する/ }));

        expect(await screen.findByRole('alert')).toHaveTextContent('しばらく時間をおいて');
    });

    it('email 未指定のときはメール入力欄を表示し、未入力ではボタンが無効', async () => {
        const user = userEvent.setup();
        render(<ResendConfirmationButton />);

        const input = screen.getByLabelText('メールアドレス');
        expect(input).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /確認メールを再送する/ })).toBeDisabled();

        await user.type(input, 'user@example.com');
        expect(screen.getByRole('button', { name: /確認メールを再送する/ })).toBeEnabled();
    });
});
