import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const enrollPhoneFactor = vi.fn();
const verifyPhoneFactor = vi.fn();
const disablePhoneFactor = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh }),
}));

vi.mock('@/features/mfa/server/actions', () => ({
    enrollPhoneFactor: (...args: unknown[]) => enrollPhoneFactor(...args),
    verifyPhoneFactor: (...args: unknown[]) => verifyPhoneFactor(...args),
    disablePhoneFactor: (...args: unknown[]) => disablePhoneFactor(...args),
}));

import { TwoFactorSettings } from './TwoFactorSettings';

describe('TwoFactorSettings', () => {
    beforeEach(() => {
        enrollPhoneFactor.mockReset();
        verifyPhoneFactor.mockReset();
        disablePhoneFactor.mockReset();
        refresh.mockReset();
    });

    it('有効時は無効化ボタンを表示し、クリックで disablePhoneFactor を呼ぶ', async () => {
        disablePhoneFactor.mockResolvedValueOnce({ success: true });
        const user = userEvent.setup();
        render(<TwoFactorSettings initialEnabled initialFactorId="factor-1" />);

        await user.click(screen.getByRole('button', { name: /無効化/ }));

        expect(disablePhoneFactor).toHaveBeenCalledWith('factor-1');
    });

    it('未有効時、不正な電話番号ではエラーを出し enroll を呼ばない', async () => {
        const user = userEvent.setup();
        render(<TwoFactorSettings initialEnabled={false} initialFactorId={null} />);

        await user.type(screen.getByLabelText('電話番号（国際形式）'), '09012345678');
        await user.click(screen.getByRole('button', { name: /確認コードを送信する/ }));

        expect(await screen.findByRole('alert')).toHaveTextContent('国際形式');
        expect(enrollPhoneFactor).not.toHaveBeenCalled();
    });

    it('正しい電話番号で enroll → コード入力欄が出て、verify で有効化する', async () => {
        enrollPhoneFactor.mockResolvedValueOnce({ success: true, factorId: 'factor-1', challengeId: 'challenge-1' });
        verifyPhoneFactor.mockResolvedValueOnce({ success: true });
        const user = userEvent.setup();
        render(<TwoFactorSettings initialEnabled={false} initialFactorId={null} />);

        await user.type(screen.getByLabelText('電話番号（国際形式）'), '+819012345678');
        await user.click(screen.getByRole('button', { name: /確認コードを送信する/ }));

        expect(enrollPhoneFactor).toHaveBeenCalledWith('+819012345678');
        const codeInput = await screen.findByLabelText(/確認コード/);
        await user.type(codeInput, '123456');
        await user.click(screen.getByRole('button', { name: /確認して有効化する/ }));

        expect(verifyPhoneFactor).toHaveBeenCalledWith('factor-1', 'challenge-1', '123456');
        expect(refresh).toHaveBeenCalled();
    });
});
