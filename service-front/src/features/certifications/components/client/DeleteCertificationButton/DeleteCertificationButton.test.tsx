import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const deleteCertification = vi.fn();
const routerPush = vi.fn();
const routerRefresh = vi.fn();

vi.mock('@/features/certifications/server/actions', () => ({
    deleteCertification: (...args: unknown[]) => deleteCertification(...args),
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: routerPush, refresh: routerRefresh }),
}));

import { DeleteCertificationButton } from './DeleteCertificationButton';

describe('DeleteCertificationButton', () => {
    beforeEach(() => {
        deleteCertification.mockReset();
        routerPush.mockReset();
        routerRefresh.mockReset();
    });

    it('初期状態ではダイアログを表示しない', () => {
        render(<DeleteCertificationButton certificationId="c1" name="PADI オープンウォーター" />);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('削除ボタンを押すと資格名入りの確認ダイアログを表示する', async () => {
        const user = userEvent.setup();
        render(<DeleteCertificationButton certificationId="c1" name="PADI オープンウォーター" />);

        await user.click(screen.getByRole('button', { name: '削除' }));

        expect(screen.getByRole('dialog', { name: 'PADI オープンウォーター を削除しますか？' })).toBeInTheDocument();
    });

    it('キャンセルでダイアログを閉じ deleteCertification は呼ばれない', async () => {
        const user = userEvent.setup();
        render(<DeleteCertificationButton certificationId="c1" name="PADI オープンウォーター" />);

        await user.click(screen.getByRole('button', { name: '削除' }));
        await user.click(screen.getByRole('button', { name: 'キャンセル' }));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(deleteCertification).not.toHaveBeenCalled();
    });

    it('Esc キーでダイアログを閉じる', async () => {
        const user = userEvent.setup();
        render(<DeleteCertificationButton certificationId="c1" name="PADI オープンウォーター" />);

        await user.click(screen.getByRole('button', { name: '削除' }));
        await user.keyboard('{Escape}');

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('削除成功時に deleteCertification(certificationId) を呼びダイアログを閉じて再フェッチする', async () => {
        deleteCertification.mockResolvedValueOnce({ success: true });
        const user = userEvent.setup();
        render(<DeleteCertificationButton certificationId="c1" name="PADI オープンウォーター" />);

        await user.click(screen.getByRole('button', { name: '削除' }));
        await user.click(screen.getByRole('button', { name: '削除する' }));

        expect(deleteCertification).toHaveBeenCalledWith('c1');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(routerRefresh).toHaveBeenCalled();
        expect(routerPush).not.toHaveBeenCalled();
    });

    it('deleteCertification が失敗するとダイアログを閉じてエラーメッセージを表示し再フェッチしない', async () => {
        deleteCertification.mockResolvedValueOnce({ success: false, error: '削除に失敗しました' });
        const user = userEvent.setup();
        render(<DeleteCertificationButton certificationId="c1" name="PADI オープンウォーター" />);

        await user.click(screen.getByRole('button', { name: '削除' }));
        await user.click(screen.getByRole('button', { name: '削除する' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('削除に失敗しました');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(routerRefresh).not.toHaveBeenCalled();
    });
});
