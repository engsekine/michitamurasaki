import { render, screen, within } from '@testing-library/react';
import { GUIDE_SECTIONS } from '../../constants';
import { GuideView } from './GuideView';

describe('GuideView', () => {
    it('h1「使い方」を 1 つ表示する', () => {
        render(<GuideView />);

        expect(screen.getByRole('heading', { level: 1, name: '使い方' })).toBeInTheDocument();
    });

    it('GUIDE_SECTIONS の 6 セクションをすべて表示する', () => {
        render(<GuideView />);

        expect(GUIDE_SECTIONS).toHaveLength(6);
        for (const section of GUIDE_SECTIONS) {
            expect(screen.getByRole('heading', { level: 2, name: section.title })).toBeInTheDocument();
        }
    });

    it('examples で渡した ReactNode が該当セクションに注入される', () => {
        render(<GuideView examples={{ 'dive-logs': <div data-testid="dive-logs-example">例示</div> }} />);

        const section = screen.getByRole('region', { name: 'ダイブログを記録する' });
        expect(section).toContainElement(screen.getByTestId('dive-logs-example'));
    });

    it('ページ末尾に登録 CTA（無料で始める → /signup）を表示する（FR-005）', () => {
        render(<GuideView />);

        expect(screen.getByRole('link', { name: '無料で始める' })).toHaveAttribute('href', '/signup');
    });

    it('目次から全セクションへのアンカーリンクを表示する（FR-003）', () => {
        render(<GuideView />);

        const toc = screen.getByRole('navigation', { name: '目次' });
        for (const section of GUIDE_SECTIONS) {
            const link = within(toc).getByRole('link', { name: section.title });
            expect(link).toHaveAttribute('href', `#${section.id}`);

            // アンカーのジャンプ先（h2 の id）が存在する
            expect(screen.getByRole('heading', { level: 2, name: section.title })).toHaveAttribute('id', section.id);
        }
    });

    it('各セクションに目次へ戻る導線を表示する', () => {
        render(<GuideView />);

        const backLinks = screen.getAllByRole('link', { name: '目次に戻る' });
        expect(backLinks).toHaveLength(GUIDE_SECTIONS.length);
        for (const link of backLinks) {
            expect(link).toHaveAttribute('href', '#guide-toc');
        }
    });
});
