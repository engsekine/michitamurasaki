import { render, screen } from '@testing-library/react';

import { MAP_UNAVAILABLE_MESSAGE } from '@/features/shops/constants';

import { ShopMap } from './ShopMap';

describe('ShopMap', () => {
    it('座標があると Google マップの iframe を表示する（title・遅延読み込み付き）', () => {
        render(<ShopMap latitude={34.9066} longitude={139.1325} shopName="マリンステージ" />);

        const iframe = screen.getByTitle('マリンステージ の地図');
        expect(iframe.tagName).toBe('IFRAME');
        expect(iframe).toHaveAttribute('src', 'https://maps.google.com/maps?q=34.9066,139.1325&z=16&output=embed');
        expect(iframe).toHaveAttribute('loading', 'lazy');
        expect(iframe).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');
    });

    it('座標が null のときは iframe を出さず role="status" のメッセージを表示する（FR-013）', () => {
        render(<ShopMap latitude={null} longitude={null} shopName="マリンステージ" />);

        expect(screen.getByRole('status')).toHaveTextContent(MAP_UNAVAILABLE_MESSAGE);
        expect(screen.queryByTitle(/の地図/)).not.toBeInTheDocument();
    });

    it('片方の座標だけ null の場合もメッセージ表示に倒す（不整合データの防御）', () => {
        render(<ShopMap latitude={34.9066} longitude={null} shopName="マリンステージ" />);

        expect(screen.getByRole('status')).toBeInTheDocument();
        expect(screen.queryByTitle(/の地図/)).not.toBeInTheDocument();
    });
});
