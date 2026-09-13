import { render, screen, within } from '@testing-library/react';

import { ShopLinkedRecords } from './ShopLinkedRecords';

const plans = [
    { id: 'plan-1', plannedOn: '2026-07-12', location: '伊豆 / 田子' },
    { id: 'plan-2', plannedOn: '2026-08-20', location: '和歌山 / 串本' },
];

const dives = [{ id: 'dive-1', diveDate: '2026-06-14', location: '伊豆 / 大瀬崎' }];

describe('ShopLinkedRecords', () => {
    it('紐付いた予定・ログの見出しと各詳細へのリンクを表示する（FR-016）', () => {
        render(<ShopLinkedRecords plans={plans} dives={dives} />);

        const plansSection = screen.getByRole('region', { name: 'このショップの予定' });
        expect(within(plansSection).getByRole('link', { name: /伊豆 \/ 田子/ })).toHaveAttribute(
            'href',
            '/plans/plan-1',
        );
        expect(within(plansSection).getAllByRole('listitem')).toHaveLength(2);

        const divesSection = screen.getByRole('region', { name: 'このショップのログ' });
        expect(within(divesSection).getByRole('link', { name: /伊豆 \/ 大瀬崎/ })).toHaveAttribute(
            'href',
            '/dives/dive-1',
        );
    });

    it('紐付きが 0 件のセクションはその旨のメッセージを表示する', () => {
        render(<ShopLinkedRecords plans={[]} dives={[]} />);

        expect(screen.getByText('紐付いた予定はありません')).toBeInTheDocument();
        expect(screen.getByText('紐付いたログはありません')).toBeInTheDocument();
        expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });

    it('ログのポイント名が空のときはフォールバック文言を表示する', () => {
        render(<ShopLinkedRecords plans={[]} dives={[{ id: 'dive-2', diveDate: '2026-06-01', location: '' }]} />);

        expect(screen.getByText('ポイント未設定')).toBeInTheDocument();
    });
});
