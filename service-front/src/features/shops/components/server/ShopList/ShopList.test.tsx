import { render, screen, within } from '@testing-library/react';

import type { Shop } from '@/features/shops/types';

import { ShopList } from './ShopList';

const buildShop = (overrides: Partial<Shop> = {}): Shop => ({
    id: 'shop-1',
    name: 'サンゴ礁ダイビングショップ',
    address: '沖縄県石垣市石垣1-1',
    phone: '0980-00-0000',
    websiteUrl: 'https://example.com',
    memo: '',
    latitude: 24.3,
    longitude: 124.1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
});

describe('ShopList', () => {
    describe('ショップが 0 件のとき', () => {
        it('空状態メッセージを表示する', () => {
            render(<ShopList shops={[]} />);
            expect(screen.getByText(/ショップがまだ登録されていません/)).toBeInTheDocument();
        });

        it('「ショップを登録」リンクが /shops/new を指している', () => {
            render(<ShopList shops={[]} />);
            expect(screen.getByRole('link', { name: 'ショップを登録' })).toHaveAttribute('href', '/shops/new');
        });

        it('リスト要素を表示しない', () => {
            render(<ShopList shops={[]} />);
            expect(screen.queryByRole('list')).not.toBeInTheDocument();
        });
    });

    describe('ショップが 1 件以上のとき', () => {
        it('ショップ名・住所・電話番号を表示する', () => {
            render(<ShopList shops={[buildShop()]} />);
            expect(screen.getByText('サンゴ礁ダイビングショップ')).toBeInTheDocument();
            expect(screen.getByText('沖縄県石垣市石垣1-1')).toBeInTheDocument();
            expect(screen.getByText('0980-00-0000')).toBeInTheDocument();
        });

        it('カードリンクがショップ詳細ページ（/shops/<id>）を指している', () => {
            render(<ShopList shops={[buildShop({ id: 'shop-abc' })]} />);
            expect(screen.getByRole('link', { name: /サンゴ礁ダイビングショップ/ })).toHaveAttribute(
                'href',
                '/shops/shop-abc',
            );
        });

        it('address が空文字のとき住所を表示しない', () => {
            render(<ShopList shops={[buildShop({ address: '' })]} />);
            expect(screen.queryByText('沖縄県石垣市石垣1-1')).not.toBeInTheDocument();
        });

        it('phone が空文字のとき電話番号を表示しない', () => {
            render(<ShopList shops={[buildShop({ phone: '' })]} />);
            expect(screen.queryByText('0980-00-0000')).not.toBeInTheDocument();
        });

        it('address も phone も空のとき、カードにはショップ名だけ表示する', () => {
            render(<ShopList shops={[buildShop({ address: '', phone: '' })]} />);
            const listitem = screen.getByRole('listitem');
            expect(within(listitem).getByRole('link')).toHaveTextContent(/^サンゴ礁ダイビングショップ$/);
        });

        it('複数件のショップを全件表示する', () => {
            const shops = [
                buildShop({ id: 'shop-1', name: 'ショップA' }),
                buildShop({ id: 'shop-2', name: 'ショップB' }),
                buildShop({ id: 'shop-3', name: 'ショップC' }),
            ];
            render(<ShopList shops={shops} />);
            expect(screen.getAllByRole('listitem')).toHaveLength(3);
            expect(screen.getByText('ショップA')).toBeInTheDocument();
            expect(screen.getByText('ショップB')).toBeInTheDocument();
            expect(screen.getByText('ショップC')).toBeInTheDocument();
        });

        it('各ショップのリンクが対応する詳細ページを指している', () => {
            const shops = [
                buildShop({ id: 'shop-1', name: 'ショップA' }),
                buildShop({ id: 'shop-2', name: 'ショップB' }),
            ];
            render(<ShopList shops={shops} />);
            expect(screen.getByRole('link', { name: /ショップA/ })).toHaveAttribute('href', '/shops/shop-1');
            expect(screen.getByRole('link', { name: /ショップB/ })).toHaveAttribute('href', '/shops/shop-2');
        });

        it('空状態メッセージと「ショップを登録」リンクは表示しない', () => {
            render(<ShopList shops={[buildShop()]} />);
            expect(screen.queryByText(/ショップがまだ登録されていません/)).not.toBeInTheDocument();
            expect(screen.queryByRole('link', { name: 'ショップを登録' })).not.toBeInTheDocument();
        });
    });
});
