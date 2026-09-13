import { render, screen } from '@testing-library/react';
import { NoCreditBanner } from './NoCreditBanner';

describe('NoCreditBanner', () => {
    it('role="alert" の要素を表示する', () => {
        render(<NoCreditBanner />);

        expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('タイトル「ログ枠がありません」を表示する', () => {
        render(<NoCreditBanner />);

        expect(screen.getByText('ログ枠がありません')).toBeInTheDocument();
    });

    it('デイリーボーナスの説明文を表示する', () => {
        render(<NoCreditBanner />);

        expect(screen.getByText(/ログ枠は毎日 1 つ自動で追加されます。/)).toBeInTheDocument();
    });

    describe('showPurchaseLink が省略された場合（デフォルト true）', () => {
        it('購入リンクを表示する', () => {
            render(<NoCreditBanner />);

            const link = screen.getByRole('link', { name: 'ログパックを購入（¥480 から）' });
            expect(link).toBeInTheDocument();
        });

        it('購入リンクの href が /settings/log-credits である', () => {
            render(<NoCreditBanner />);

            const link = screen.getByRole('link', { name: 'ログパックを購入（¥480 から）' });
            expect(link).toHaveAttribute('href', '/settings/log-credits');
        });

        it('購入を促す説明文を表示する', () => {
            render(<NoCreditBanner />);

            expect(screen.getByText(/今すぐ記録するにはログパックを購入してください。/)).toBeInTheDocument();
        });
    });

    describe('showPurchaseLink=false の場合', () => {
        it('購入リンクを表示しない', () => {
            render(<NoCreditBanner showPurchaseLink={false} />);

            expect(screen.queryByRole('link')).not.toBeInTheDocument();
        });

        it('購入を促す説明文を表示しない', () => {
            render(<NoCreditBanner showPurchaseLink={false} />);

            expect(screen.queryByText(/今すぐ記録するにはログパックを購入してください。/)).not.toBeInTheDocument();
        });
    });
});
