import { render, screen } from '@testing-library/react';

import { LandingPricing } from './LandingPricing';

const PACKS = [
    {
        quantity: 10,
        amountJpy: 480,
        displayName: 'お試しパック（10 枠）',
        discountLabel: null,
        isRecommended: false,
    },
    {
        quantity: 30,
        amountJpy: 1200,
        displayName: 'おすすめパック（30 枠）',
        discountLabel: '約17%おトク',
        isRecommended: true,
    },
    {
        quantity: 100,
        amountJpy: 3000,
        displayName: 'たっぷりパック（100 枠）',
        discountLabel: '約37%おトク',
        isRecommended: false,
    },
];

describe('LandingPricing', () => {
    it('注入された全パックの価格・枠数を表示する（ハードコードしない）', () => {
        render(<LandingPricing packs={PACKS} initialGrantAmount={10} dailyBonusAmount={1} />);
        // ログパック価格（3 桁区切り + 円）
        expect(screen.getByText('480 円')).toBeInTheDocument();
        expect(screen.getByText('1,200 円')).toBeInTheDocument();
        expect(screen.getByText('3,000 円')).toBeInTheDocument();
        // パック名と単価
        expect(screen.getByText('お試しパック（10 枠）')).toBeInTheDocument();
        expect(screen.getByText(/1 ログあたり 48 円/)).toBeInTheDocument();
        expect(screen.getByText(/1 ログあたり 40 円/)).toBeInTheDocument();
        expect(screen.getByText(/1 ログあたり 30 円/)).toBeInTheDocument();
        // 割引率とおすすめバッジ
        expect(screen.getByText('約17%おトク')).toBeInTheDocument();
        expect(screen.getByText('約37%おトク')).toBeInTheDocument();
        expect(screen.getByText('おすすめ')).toBeInTheDocument();
        // 無料枠・デイリーボーナスが本文に反映される
        expect(screen.getByText(/ログ枠 10 枠をプレゼント/)).toBeInTheDocument();
        expect(screen.getByText(/毎日ログインで \+1 枠/)).toBeInTheDocument();
    });

    it('価格が変わっても props の値がそのまま表示に反映される', () => {
        render(
            <LandingPricing
                packs={[
                    {
                        quantity: 50,
                        amountJpy: 2000,
                        displayName: 'テストパック（50 枠）',
                        discountLabel: null,
                        isRecommended: false,
                    },
                ]}
                initialGrantAmount={5}
                dailyBonusAmount={2}
            />,
        );
        expect(screen.getByText('2,000 円')).toBeInTheDocument();
        expect(screen.getByText(/1 ログあたり 40 円/)).toBeInTheDocument();
        expect(screen.getByText(/ログ枠 5 枠をプレゼント/)).toBeInTheDocument();
        expect(screen.getByText(/毎日ログインで \+2 枠/)).toBeInTheDocument();
    });
});
