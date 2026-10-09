import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const enrollTotpFactor = vi.fn();
const verifyTotpFactor = vi.fn();
const disableTotpFactor = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh }),
}));

vi.mock('@/features/mfa/server/actions', () => ({
    enrollTotpFactor: (...args: unknown[]) => enrollTotpFactor(...args),
    verifyTotpFactor: (...args: unknown[]) => verifyTotpFactor(...args),
    disableTotpFactor: (...args: unknown[]) => disableTotpFactor(...args),
}));

import { TwoFactorSettings } from './TwoFactorSettings';

const ENROLLED = {
    success: true,
    factorId: 'factor-1',
    qrCode: 'data:image/svg+xml;utf-8,<svg/>',
    secret: 'ABCDEFGHIJKLMNOP',
};

describe('TwoFactorSettings', () => {
    beforeEach(() => {
        enrollTotpFactor.mockReset();
        verifyTotpFactor.mockReset();
        disableTotpFactor.mockReset();
        refresh.mockReset();
    });

    it('有効時は無効化ボタンを表示し、クリックで disableTotpFactor を呼ぶ', async () => {
        disableTotpFactor.mockResolvedValueOnce({ success: true });
        const user = userEvent.setup();
        render(<TwoFactorSettings initialEnabled initialFactorId="factor-1" />);

        await user.click(screen.getByRole('button', { name: /無効化/ }));

        expect(disableTotpFactor).toHaveBeenCalledWith('factor-1');
    });

    it('未有効時は設定開始ボタンのみで、QR コードはまだ出さない', () => {
        render(<TwoFactorSettings initialEnabled={false} initialFactorId={null} />);

        expect(screen.getByRole('button', { name: /認証アプリを設定する/ })).toBeInTheDocument();
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
        expect(enrollTotpFactor).not.toHaveBeenCalled();
    });

    it('設定開始で enroll → QR コードとシークレットを表示し、コード確認で有効化する', async () => {
        enrollTotpFactor.mockResolvedValueOnce(ENROLLED);
        verifyTotpFactor.mockResolvedValueOnce({ success: true });
        const user = userEvent.setup();
        render(<TwoFactorSettings initialEnabled={false} initialFactorId={null} />);

        await user.click(screen.getByRole('button', { name: /認証アプリを設定する/ }));

        expect(enrollTotpFactor).toHaveBeenCalled();
        expect(await screen.findByRole('img', { name: /QR コード/ })).toHaveAttribute('src', ENROLLED.qrCode);
        expect(screen.getByText(ENROLLED.secret)).toBeInTheDocument();

        await user.type(screen.getByLabelText(/確認コード/), '123456');
        await user.click(screen.getByRole('button', { name: /確認して有効化する/ }));

        expect(verifyTotpFactor).toHaveBeenCalledWith('factor-1', '123456');
        expect(refresh).toHaveBeenCalled();
    });

    it('桁数が不正ならサーバーを呼ばずにエラーを出す', async () => {
        enrollTotpFactor.mockResolvedValueOnce(ENROLLED);
        const user = userEvent.setup();
        render(<TwoFactorSettings initialEnabled={false} initialFactorId={null} />);

        await user.click(screen.getByRole('button', { name: /認証アプリを設定する/ }));
        await user.type(await screen.findByLabelText(/確認コード/), '12');
        await user.click(screen.getByRole('button', { name: /確認して有効化する/ }));

        expect(await screen.findByRole('alert')).toHaveTextContent('6 桁の数字');
        expect(verifyTotpFactor).not.toHaveBeenCalled();
    });

    it('enroll 失敗時はエラーを表示する', async () => {
        enrollTotpFactor.mockResolvedValueOnce({ success: false, error: '認証アプリの設定を開始できませんでした' });
        const user = userEvent.setup();
        render(<TwoFactorSettings initialEnabled={false} initialFactorId={null} />);

        await user.click(screen.getByRole('button', { name: /認証アプリを設定する/ }));

        expect(await screen.findByRole('alert')).toHaveTextContent('認証アプリの設定を開始できませんでした');
    });
});
