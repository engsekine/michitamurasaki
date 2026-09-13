import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const createShop = vi.fn();
const updateShop = vi.fn();
const geocodeAddress = vi.fn();
const routerPush = vi.fn();
const routerRefresh = vi.fn();

vi.mock('@/features/shops/server/actions', () => ({
    createShop: (...args: unknown[]) => createShop(...args),
    updateShop: (...args: unknown[]) => updateShop(...args),
    geocodeAddress: (...args: unknown[]) => geocodeAddress(...args),
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: routerPush, refresh: routerRefresh }),
}));

import { ShopForm } from './ShopForm';

describe('ShopForm', () => {
    beforeEach(() => {
        createShop.mockReset();
        updateShop.mockReset();
        geocodeAddress.mockReset();
        geocodeAddress.mockResolvedValue({ success: true, latitude: 34.9066, longitude: 139.1325 });
        routerPush.mockReset();
        routerRefresh.mockReset();
    });

    it('ショップ名・住所・電話番号・Web サイト URL・メモの入力欄を表示する', () => {
        render(<ShopForm />);
        expect(screen.getByLabelText(/ショップ名/)).toBeInTheDocument();
        expect(screen.getByLabelText(/住所/)).toBeInTheDocument();
        expect(screen.getByLabelText(/電話番号/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Web サイト URL/)).toBeInTheDocument();
        expect(screen.getByLabelText(/メモ/)).toBeInTheDocument();
    });

    it('新規登録モードでは「登録する」ボタンを表示する', () => {
        render(<ShopForm />);
        expect(screen.getByRole('button', { name: '登録する' })).toBeInTheDocument();
    });

    it('編集モードでは「更新する」ボタンを表示する', () => {
        render(<ShopForm shopId="shop-abc" defaultValues={{ name: 'テストショップ' }} />);
        expect(screen.getByRole('button', { name: '更新する' })).toBeInTheDocument();
    });

    it('ショップ名が未入力のまま送信するとバリデーションエラーを表示し、アクションを呼ばない', async () => {
        const user = userEvent.setup();
        render(<ShopForm />);

        await user.click(screen.getByRole('button', { name: '登録する' }));

        expect(await screen.findByText('ショップ名を入力してください')).toBeInTheDocument();
        expect(createShop).not.toHaveBeenCalled();
        expect(updateShop).not.toHaveBeenCalled();
    });

    it('新規登録成功時に createShop を入力値で呼び、詳細ページへ遷移する', async () => {
        createShop.mockResolvedValueOnce({ success: true, id: 'new-shop-id' });
        const user = userEvent.setup();
        render(<ShopForm />);

        await user.type(screen.getByLabelText(/ショップ名/), 'マリンステージ');
        await user.type(screen.getByLabelText(/住所/), '静岡県伊東市富戸 837-2');
        await user.click(screen.getByRole('button', { name: '登録する' }));

        expect(createShop).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'マリンステージ', address: '静岡県伊東市富戸 837-2' }),
        );
        expect(routerPush).toHaveBeenCalledWith('/shops/new-shop-id');
        expect(updateShop).not.toHaveBeenCalled();
    });

    it('編集モードで送信すると updateShop(shopId, values) を呼び、詳細ページへ遷移する', async () => {
        updateShop.mockResolvedValueOnce({ success: true });
        const user = userEvent.setup();
        render(<ShopForm shopId="existing-shop-id" defaultValues={{ name: '既存ショップ', phone: '0557-51-3535' }} />);

        await user.click(screen.getByRole('button', { name: '更新する' }));

        expect(updateShop).toHaveBeenCalledWith(
            'existing-shop-id',
            expect.objectContaining({ name: '既存ショップ', phone: '0557-51-3535' }),
        );
        expect(routerPush).toHaveBeenCalledWith('/shops/existing-shop-id');
        expect(createShop).not.toHaveBeenCalled();
    });

    it('createShop がエラーを返すと role="alert" にサーバーエラーを表示し、遷移しない', async () => {
        createShop.mockResolvedValueOnce({
            success: false,
            error: 'ショップの登録に失敗しました。時間をおいて再度お試しください',
        });
        const user = userEvent.setup();
        render(<ShopForm />);

        await user.type(screen.getByLabelText(/ショップ名/), 'エラーショップ');
        await user.click(screen.getByRole('button', { name: '登録する' }));

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('ショップの登録に失敗しました。時間をおいて再度お試しください');
        expect(routerPush).not.toHaveBeenCalled();
    });

    it('updateShop がエラーを返すと role="alert" にサーバーエラーを表示し、遷移しない', async () => {
        updateShop.mockResolvedValueOnce({
            success: false,
            error: 'ショップの更新に失敗しました。時間をおいて再度お試しください',
        });
        const user = userEvent.setup();
        render(<ShopForm shopId="shop-xyz" defaultValues={{ name: '更新失敗ショップ' }} />);

        await user.click(screen.getByRole('button', { name: '更新する' }));

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('ショップの更新に失敗しました。時間をおいて再度お試しください');
        expect(routerPush).not.toHaveBeenCalled();
    });

    describe('地図プレビュー（US3 / FR-011・FR-013）', () => {
        it('住所を入力して確定（blur）すると geocodeAddress が呼ばれ地図プレビューが表示される', async () => {
            const user = userEvent.setup();
            render(<ShopForm />);

            await user.type(screen.getByLabelText(/住所/), '静岡県伊東市富戸 837-2');
            await user.tab();

            expect(geocodeAddress).toHaveBeenCalledWith('静岡県伊東市富戸 837-2');
            expect(await screen.findByTitle('入力中の住所 の地図')).toBeInTheDocument();
        });

        it('位置を特定できない住所は地図の代わりにメッセージを表示する', async () => {
            geocodeAddress.mockResolvedValue({ success: true, latitude: null, longitude: null });
            const user = userEvent.setup();
            render(<ShopForm />);

            await user.type(screen.getByLabelText(/住所/), 'あいうえお市かきくけこ 9-9-9');
            await user.tab();

            expect(await screen.findByRole('status')).toBeInTheDocument();
            expect(screen.queryByTitle('入力中の住所 の地図')).not.toBeInTheDocument();
        });

        it('住所が空のまま確定してもプレビューは表示されず geocodeAddress も呼ばれない', async () => {
            const user = userEvent.setup();
            render(<ShopForm />);

            await user.click(screen.getByLabelText(/住所/));
            await user.tab();

            expect(geocodeAddress).not.toHaveBeenCalled();
            expect(screen.queryByTitle('入力中の住所 の地図')).not.toBeInTheDocument();
            expect(screen.queryByRole('status')).not.toBeInTheDocument();
        });

        it('編集モードで initialCoordinates があると初期表示から地図が出る（FR-012 と同じ表示）', () => {
            render(
                <ShopForm
                    shopId="shop-1"
                    defaultValues={{ name: 'ショップ', address: '静岡県伊東市富戸' }}
                    initialCoordinates={{ latitude: 34.9, longitude: 139.1 }}
                />,
            );

            expect(screen.getByTitle('入力中の住所 の地図')).toBeInTheDocument();
            expect(geocodeAddress).not.toHaveBeenCalled();
        });
    });

    it('defaultValues が渡されるとフォームに初期値が反映される', () => {
        render(
            <ShopForm
                shopId="shop-default"
                defaultValues={{
                    name: '初期ショップ名',
                    address: '東京都港区',
                    phone: '03-1234-5678',
                    websiteUrl: 'https://example.com',
                    memo: '備考テキスト',
                }}
            />,
        );

        expect(screen.getByLabelText<HTMLInputElement>(/ショップ名/).value).toBe('初期ショップ名');
        expect(screen.getByLabelText<HTMLInputElement>(/住所/).value).toBe('東京都港区');
        expect(screen.getByLabelText<HTMLInputElement>(/電話番号/).value).toBe('03-1234-5678');
        expect(screen.getByLabelText<HTMLInputElement>(/Web サイト URL/).value).toBe('https://example.com');
        expect(screen.getByLabelText<HTMLTextAreaElement>(/メモ/).value).toBe('備考テキスト');
    });
});
