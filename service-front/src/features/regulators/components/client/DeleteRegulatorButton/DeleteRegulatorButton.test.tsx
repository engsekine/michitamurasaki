import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const deleteRegulator = vi.fn();
const routerPush = vi.fn();
const routerRefresh = vi.fn();

vi.mock('@/features/regulators/server/actions', () => ({
    deleteRegulator: (...args: unknown[]) => deleteRegulator(...args),
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: routerPush, refresh: routerRefresh }),
}));

import { DeleteRegulatorButton } from './DeleteRegulatorButton';

describe('DeleteRegulatorButton', () => {
    beforeEach(() => {
        deleteRegulator.mockReset();
        routerPush.mockReset();
        routerRefresh.mockReset();
    });

    it('初期状態ではダイアログを表示しない', () => {
        render(<DeleteRegulatorButton regulatorId="r1" name="SCUBAPRO MK25 EVO" />);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('削除ボタンを押すと機材名入りの確認ダイアログを表示する', async () => {
        const user = userEvent.setup();
        render(<DeleteRegulatorButton regulatorId="r1" name="SCUBAPRO MK25 EVO" />);

        await user.click(screen.getByRole('button', { name: '削除' }));

        expect(screen.getByRole('dialog', { name: 'SCUBAPRO MK25 EVO を削除しますか？' })).toBeInTheDocument();
    });

    it('キャンセルでダイアログを閉じ deleteRegulator は呼ばれない', async () => {
        const user = userEvent.setup();
        render(<DeleteRegulatorButton regulatorId="r1" name="SCUBAPRO MK25 EVO" />);

        await user.click(screen.getByRole('button', { name: '削除' }));
        await user.click(screen.getByRole('button', { name: 'キャンセル' }));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(deleteRegulator).not.toHaveBeenCalled();
    });

    it('Esc キーでダイアログを閉じる', async () => {
        const user = userEvent.setup();
        render(<DeleteRegulatorButton regulatorId="r1" name="SCUBAPRO MK25 EVO" />);

        await user.click(screen.getByRole('button', { name: '削除' }));
        await user.keyboard('{Escape}');

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('削除成功時に deleteRegulator(regulatorId) を呼びダイアログを閉じて再フェッチする', async () => {
        deleteRegulator.mockResolvedValueOnce({ success: true });
        const user = userEvent.setup();
        render(<DeleteRegulatorButton regulatorId="r1" name="SCUBAPRO MK25 EVO" />);

        await user.click(screen.getByRole('button', { name: '削除' }));
        await user.click(screen.getByRole('button', { name: '削除する' }));

        expect(deleteRegulator).toHaveBeenCalledWith('r1');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(routerRefresh).toHaveBeenCalled();
        expect(routerPush).not.toHaveBeenCalled();
    });

    it('deleteRegulator が失敗するとダイアログを閉じてエラーメッセージを表示し再フェッチしない', async () => {
        deleteRegulator.mockResolvedValueOnce({ success: false, error: '削除に失敗しました' });
        const user = userEvent.setup();
        render(<DeleteRegulatorButton regulatorId="r1" name="SCUBAPRO MK25 EVO" />);

        await user.click(screen.getByRole('button', { name: '削除' }));
        await user.click(screen.getByRole('button', { name: '削除する' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('削除に失敗しました');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(routerRefresh).not.toHaveBeenCalled();
    });
});
