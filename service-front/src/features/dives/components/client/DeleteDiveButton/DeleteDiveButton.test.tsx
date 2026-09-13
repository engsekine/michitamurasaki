import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const deleteDive = vi.fn();

vi.mock('@/features/dives/server/actions', () => ({
    deleteDive: (...args: unknown[]) => deleteDive(...args),
}));

import { DeleteDiveButton } from './DeleteDiveButton';

describe('DeleteDiveButton', () => {
    beforeEach(() => {
        deleteDive.mockReset();
    });

    it('初期状態ではダイアログを表示しない', () => {
        render(<DeleteDiveButton diveId="d1" />);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('削除ボタンを押すと確認ダイアログを表示する', async () => {
        const user = userEvent.setup();
        render(<DeleteDiveButton diveId="d1" />);

        await user.click(screen.getByRole('button', { name: '削除' }));

        expect(screen.getByRole('dialog', { name: 'ログを削除しますか？' })).toBeInTheDocument();
    });

    it('キャンセルでダイアログを閉じ deleteDive は呼ばれない', async () => {
        const user = userEvent.setup();
        render(<DeleteDiveButton diveId="d1" />);

        await user.click(screen.getByRole('button', { name: '削除' }));
        await user.click(screen.getByRole('button', { name: 'キャンセル' }));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(deleteDive).not.toHaveBeenCalled();
    });

    it('削除するを押すと deleteDive(diveId) が呼ばれる', async () => {
        deleteDive.mockResolvedValueOnce({ success: true });
        const user = userEvent.setup();
        render(<DeleteDiveButton diveId="d1" />);

        await user.click(screen.getByRole('button', { name: '削除' }));
        await user.click(screen.getByRole('button', { name: '削除する' }));

        expect(deleteDive).toHaveBeenCalledWith('d1');
    });

    it('deleteDive が失敗するとダイアログを閉じてエラーメッセージを表示する', async () => {
        deleteDive.mockResolvedValueOnce({ success: false, error: '削除に失敗しました' });
        const user = userEvent.setup();
        render(<DeleteDiveButton diveId="d1" />);

        await user.click(screen.getByRole('button', { name: '削除' }));
        await user.click(screen.getByRole('button', { name: '削除する' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('削除に失敗しました');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
