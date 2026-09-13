import { render, screen } from '@testing-library/react';
import { PAGE_DATA } from '../../constants';
import { GuideIntroSection } from './GuideIntroSection';

describe('GuideIntroSection', () => {
    it('セクションが見出し「使い方ガイド」と関連付く', () => {
        render(<GuideIntroSection />);

        expect(screen.getByRole('region', { name: '使い方ガイド' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 2, name: '使い方ガイド' })).toBeInTheDocument();
    });

    it('使い方ページの紹介文を表示する（PAGE_DATA.description と同一の単一情報源）', () => {
        render(<GuideIntroSection />);

        expect(screen.getByText(PAGE_DATA.description)).toBeInTheDocument();
    });

    it('「使い方を見る」導線が /guide に遷移する', () => {
        render(<GuideIntroSection />);

        expect(screen.getByRole('link', { name: '使い方を見る' })).toHaveAttribute('href', '/guide');
    });
});
