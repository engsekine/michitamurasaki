import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const deleteShop = vi.fn();
const routerPush = vi.fn();
const routerRefresh = vi.fn();

vi.mock('@/features/shops/server/actions', () => ({
    deleteShop: (...args: unknown[]) => deleteShop(...args),
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: routerPush, refresh: routerRefresh }),
}));

import { DeleteShopButton } from './DeleteShopButton';

describe('DeleteShopButton', () => {
    beforeEach(() => {
        deleteShop.mockReset();
        routerPush.mockReset();
        routerRefresh.mockReset();
    });

    it('初期状態ではダイアログを表示しない', () => {
        render(<DeleteShopButton shopId="shop-1" />);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('初期状態ではエラーメッセージを表示しない', () => {
        render(<DeleteShopButton shopId="shop-1" />);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('削除ボタンを押すと確認ダイアログを表示する', async () => {
        const user = userEvent.setup();
        render(<DeleteShopButton shopId="shop-1" />);

        await user.click(screen.getByRole('button', { name: '削除' }));

        expect(screen.getByRole('dialog', { name: 'ショップを削除しますか？' })).toBeInTheDocument();
    });

    it('キャンセルでダイアログを閉じ deleteShop は呼ばれない', async () => {
        const user = userEvent.setup();
        render(<DeleteShopButton shopId="shop-1" />);

        await user.click(screen.getByRole('button', { name: '削除' }));
        await user.click(screen.getByRole('button', { name: 'キャンセル' }));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(deleteShop).not.toHaveBeenCalled();
    });

    it('Esc キーでダイアログを閉じる', async () => {
        const user = userEvent.setup();
        render(<DeleteShopButton shopId="shop-1" />);

        await user.click(screen.getByRole('button', { name: '削除' }));
        await user.keyboard('{Escape}');

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('削除成功時に deleteShop(shopId) を呼び一覧へ遷移する', async () => {
        deleteShop.mockResolvedValueOnce({ success: true });
        const user = userEvent.setup();
        render(<DeleteShopButton shopId="shop-1" />);

        await user.click(screen.getByRole('button', { name: '削除' }));
        await user.click(screen.getByRole('button', { name: '削除する' }));

        expect(deleteShop).toHaveBeenCalledWith('shop-1');
        expect(routerPush).toHaveBeenCalledWith('/shops');
        expect(routerRefresh).toHaveBeenCalled();
    });

    it('deleteShop が失敗するとダイアログを閉じてエラーメッセージを表示し遷移しない', async () => {
        deleteShop.mockResolvedValueOnce({ success: false, error: '削除に失敗しました' });
        const user = userEvent.setup();
        render(<DeleteShopButton shopId="shop-1" />);

        await user.click(screen.getByRole('button', { name: '削除' }));
        await user.click(screen.getByRole('button', { name: '削除する' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('削除に失敗しました');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(routerPush).not.toHaveBeenCalled();
    });

    it('削除ダイアログを再度開くとエラーメッセージがリセットされる', async () => {
        deleteShop.mockResolvedValueOnce({ success: false, error: '削除に失敗しました' });
        const user = userEvent.setup();
        render(<DeleteShopButton shopId="shop-1" />);

        // 1 回目: 失敗させてエラーを表示する
        await user.click(screen.getByRole('button', { name: '削除' }));
        await user.click(screen.getByRole('button', { name: '削除する' }));
        expect(await screen.findByRole('alert')).toBeInTheDocument();

        // 2 回目: 再度ダイアログを開くとエラーが消える
        await user.click(screen.getByRole('button', { name: '削除' }));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
});
