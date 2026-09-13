import { render, screen, within } from '@testing-library/react';

import type { RecentDiveItem } from '@/features/dashboard/types';

import { RecentDives } from './RecentDives';

const buildDive = (overrides: Partial<RecentDiveItem> = {}): RecentDiveItem => ({
    id: 'dive-1',
    diveDate: '2026-05-20',
    location: '石垣島・米原',
    maxDepthM: 18.5,
    bottomTimeMin: 42,
    coverThumbUrl: null,
    ...overrides,
});

describe('RecentDives', () => {
    describe('ログがあるとき', () => {
        it('日付・ポイント名・最大水深・潜水時間を表示する', () => {
            render(<RecentDives dives={[buildDive()]} />);
            const item = within(screen.getByRole('listitem'));
            expect(item.getByText('2026/05/20')).toBeInTheDocument();
            expect(item.getByText('石垣島・米原')).toBeInTheDocument();
            expect(item.getByText('18.5m')).toBeInTheDocument();
            expect(item.getByText('42分')).toBeInTheDocument();
        });

        it('各行は詳細ページへのリンクになっている', () => {
            render(<RecentDives dives={[buildDive({ id: 'dive-abc' })]} />);
            expect(screen.getByRole('link', { name: /石垣島・米原/ })).toHaveAttribute('href', '/dives/dive-abc');
        });

        it('潜水日に対応する潮回りラベルを表示する', () => {
            // 2000-01-07 は基準朔の翌日 = 大潮（specs/007 data-model.md 4 節の基準日付）
            render(<RecentDives dives={[buildDive({ diveDate: '2000-01-07' })]} />);
            expect(screen.getByText('大潮')).toBeInTheDocument();
        });

        it('日付が不正なときは潮回りラベルを表示しない', () => {
            render(<RecentDives dives={[buildDive({ diveDate: 'invalid' })]} />);
            expect(screen.queryByText(/大潮|中潮|小潮|長潮|若潮/)).not.toBeInTheDocument();
        });

        it('coverThumbUrl があればその写真を表示する', () => {
            const { container } = render(
                <RecentDives dives={[buildDive({ coverThumbUrl: 'https://example.com/thumb.webp' })]} />,
            );
            // 装飾画像は alt="" のため role=img ではなく要素で取得する
            const img = container.querySelector('img');
            expect(img).toHaveAttribute('src', 'https://example.com/thumb.webp');
        });

        it('coverThumbUrl が null ならダミー画像（ロゴ）を表示する', () => {
            const { container } = render(<RecentDives dives={[buildDive({ coverThumbUrl: null })]} />);
            const img = container.querySelector('img');
            // next/image は src を最適化 URL に変換するため、ロゴパスを含むかで判定する
            expect(img?.getAttribute('src')).toContain('logo.png');
        });

        it('「すべてのログを見る」リンクを表示する', () => {
            render(<RecentDives dives={[buildDive()]} />);
            expect(screen.getByRole('link', { name: 'すべてのログを見る' })).toHaveAttribute('href', '/dives');
        });

        it('4 件以上渡されても表示は 3 件まで', () => {
            const dives = Array.from({ length: 5 }, (_, i) => buildDive({ id: `dive-${i}`, location: `ポイント${i}` }));
            render(<RecentDives dives={dives} />);
            expect(screen.getAllByRole('listitem')).toHaveLength(3);
            expect(screen.queryByText('ポイント3')).not.toBeInTheDocument();
        });
    });

    describe('ログが 0 件のとき', () => {
        it('空メッセージと新規作成 CTA を表示する', () => {
            render(<RecentDives dives={[]} />);
            expect(screen.getByText('ログがまだありません')).toBeInTheDocument();
            expect(screen.getByRole('link', { name: '最初のログを記録しよう' })).toHaveAttribute('href', '/dives/new');
        });

        it('リストと「すべてのログを見る」リンクは表示しない', () => {
            render(<RecentDives dives={[]} />);
            expect(screen.queryByRole('list')).not.toBeInTheDocument();
            expect(screen.queryByRole('link', { name: 'すべてのログを見る' })).not.toBeInTheDocument();
        });
    });
});
