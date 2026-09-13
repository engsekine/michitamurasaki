import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const deletePlan = vi.fn();
const routerPush = vi.fn();
const routerRefresh = vi.fn();

vi.mock('@/features/plans/server/actions', () => ({
    deletePlan: (...args: unknown[]) => deletePlan(...args),
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: routerPush, refresh: routerRefresh }),
}));

import { DeletePlanButton } from './DeletePlanButton';

describe('DeletePlanButton', () => {
    beforeEach(() => {
        deletePlan.mockReset();
        routerPush.mockReset();
        routerRefresh.mockReset();
    });

    it('初期状態ではダイアログを表示しない', () => {
        render(<DeletePlanButton planId="p1" />);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('削除ボタンを押すと確認ダイアログを表示する', async () => {
        const user = userEvent.setup();
        render(<DeletePlanButton planId="p1" />);

        await user.click(screen.getByRole('button', { name: '削除' }));

        expect(screen.getByRole('dialog', { name: '予定を削除しますか？' })).toBeInTheDocument();
    });

    it('キャンセルでダイアログを閉じ deletePlan は呼ばれない', async () => {
        const user = userEvent.setup();
        render(<DeletePlanButton planId="p1" />);

        await user.click(screen.getByRole('button', { name: '削除' }));
        await user.click(screen.getByRole('button', { name: 'キャンセル' }));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(deletePlan).not.toHaveBeenCalled();
    });

    it('Esc キーでダイアログを閉じる', async () => {
        const user = userEvent.setup();
        render(<DeletePlanButton planId="p1" />);

        await user.click(screen.getByRole('button', { name: '削除' }));
        await user.keyboard('{Escape}');

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('削除成功時に deletePlan(planId) を呼び一覧へ遷移する', async () => {
        deletePlan.mockResolvedValueOnce({ success: true });
        const user = userEvent.setup();
        render(<DeletePlanButton planId="p1" />);

        await user.click(screen.getByRole('button', { name: '削除' }));
        await user.click(screen.getByRole('button', { name: '削除する' }));

        expect(deletePlan).toHaveBeenCalledWith('p1');
        expect(routerPush).toHaveBeenCalledWith('/plans');
        expect(routerRefresh).toHaveBeenCalled();
    });

    it('deletePlan が失敗するとダイアログを閉じてエラーメッセージを表示し遷移しない', async () => {
        deletePlan.mockResolvedValueOnce({ success: false, error: '削除に失敗しました' });
        const user = userEvent.setup();
        render(<DeletePlanButton planId="p1" />);

        await user.click(screen.getByRole('button', { name: '削除' }));
        await user.click(screen.getByRole('button', { name: '削除する' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('削除に失敗しました');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(routerPush).not.toHaveBeenCalled();
    });
});
