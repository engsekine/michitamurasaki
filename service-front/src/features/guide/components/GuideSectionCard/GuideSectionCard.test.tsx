import { render, screen } from '@testing-library/react';
import type { GuideSection } from '../../types';
import { GuideSectionCard } from './GuideSectionCard';

/** テスト用のセクション定義（本文は GUIDE_SECTIONS に依存させない） */
const SECTION: GuideSection = {
    id: 'test-section',
    title: 'テストセクション',
    description: 'テスト用の説明文です。',
    steps: [
        { title: 'ステップ 1', body: '最初の手順の説明。' },
        { title: 'ステップ 2', body: '次の手順の説明。' },
    ],
    links: [
        { href: '/dives/new', label: 'ログを作成する', requiresAuth: true },
        { href: '/signup', label: '無料で登録する', requiresAuth: false },
    ],
};

describe('GuideSectionCard', () => {
    it('セクションが見出しと関連付き、見出しが目次アンカー用の id を持つ', () => {
        render(<GuideSectionCard section={SECTION} />);

        const section = screen.getByRole('region', { name: 'テストセクション' });
        expect(section).toBeInTheDocument();

        const heading = screen.getByRole('heading', { level: 2, name: 'テストセクション' });
        expect(heading).toHaveAttribute('id', 'test-section');
    });

    it('導入文を表示する', () => {
        render(<GuideSectionCard section={SECTION} />);

        expect(screen.getByText('テスト用の説明文です。')).toBeInTheDocument();
    });

    it('手順を番号付きリスト（ol）でステップ順に表示する', () => {
        render(<GuideSectionCard section={SECTION} />);

        const list = screen.getByRole('list');
        expect(list.tagName).toBe('OL');

        const items = screen.getAllByRole('listitem');
        expect(items).toHaveLength(2);
        expect(items[0]).toHaveTextContent('ステップ 1');
        expect(items[0]).toHaveTextContent('最初の手順の説明。');
        expect(items[1]).toHaveTextContent('ステップ 2');
    });

    it('機能画面への導線リンクをすべて表示する', () => {
        render(<GuideSectionCard section={SECTION} />);

        expect(screen.getByRole('link', { name: 'ログを作成する' })).toHaveAttribute('href', '/dives/new');
        expect(screen.getByRole('link', { name: '無料で登録する' })).toHaveAttribute('href', '/signup');
    });

    it('example slot を渡すと描画される', () => {
        render(<GuideSectionCard section={SECTION} example={<div data-testid="example-slot">例示</div>} />);

        expect(screen.getByTestId('example-slot')).toBeInTheDocument();
    });

    it('example slot を渡さなくても描画できる', () => {
        render(<GuideSectionCard section={SECTION} />);

        expect(screen.queryByTestId('example-slot')).not.toBeInTheDocument();
    });
});
