import { render, screen } from '@testing-library/react';

import type { MonthlyDiveStat, YearlyDiveCount } from '@/features/dashboard/types';

import { DiveTrends } from './DiveTrends';

const yearlyCounts: YearlyDiveCount[] = [
    { year: 2024, diveCount: 18 },
    { year: 2025, diveCount: 24 },
    { year: 2026, diveCount: 11 },
];

/** 直近 12 ヶ月（基準 2026-06）の 0 埋め済み月別統計を組み立てる */
const buildMonthlyStats = (overrides: Partial<Record<string, Partial<MonthlyDiveStat>>> = {}): MonthlyDiveStat[] => {
    const months = [
        '2025-07',
        '2025-08',
        '2025-09',
        '2025-10',
        '2025-11',
        '2025-12',
        '2026-01',
        '2026-02',
        '2026-03',
        '2026-04',
        '2026-05',
        '2026-06',
    ];
    return months.map((month) => ({
        month,
        diveCount: 0,
        ...overrides[month],
    }));
};

const monthlyStats = buildMonthlyStats({
    '2025-08': { diveCount: 5 },
    '2026-02': { diveCount: 2 },
});

describe('DiveTrends', () => {
    describe('通常時（US1: 本数推移）', () => {
        it('年別本数カードと月別本数カードを表示する', () => {
            render(<DiveTrends yearlyCounts={yearlyCounts} monthlyStats={monthlyStats} />);
            expect(screen.getByRole('heading', { level: 3, name: '年別ダイビング本数' })).toBeInTheDocument();
            expect(
                screen.getByRole('heading', { level: 3, name: '月別ダイビング本数（直近 12 ヶ月）' }),
            ).toBeInTheDocument();
        });

        it('本数のカードは 2 枚のみ（深度・水温・潜水時間・累積のカードは表示しない）', () => {
            render(<DiveTrends yearlyCounts={yearlyCounts} monthlyStats={monthlyStats} />);
            expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(2);
        });

        it('年別グラフの aria-label に年と本数の要約を含む', () => {
            render(<DiveTrends yearlyCounts={yearlyCounts} monthlyStats={monthlyStats} />);
            expect(screen.getByRole('img', { name: /2024年 18本.*2025年 24本.*2026年 11本/ })).toBeInTheDocument();
        });

        it('ログはあるが直近 12 ヶ月が 0 本でも空状態にせず月別カードを表示する', () => {
            // research.md R-006: 空状態判定は年別集計（全期間）が空かどうかで行う
            render(<DiveTrends yearlyCounts={[{ year: 2023, diveCount: 9 }]} monthlyStats={buildMonthlyStats()} />);
            expect(
                screen.getByRole('heading', { level: 3, name: '月別ダイビング本数（直近 12 ヶ月）' }),
            ).toBeInTheDocument();
            expect(screen.queryByText(/ログを記録すると統計が表示され/)).not.toBeInTheDocument();
        });
    });

    describe('ログ 0 件のとき（FR-007）', () => {
        it('グラフの代わりに空状態と記録 CTA を表示する', () => {
            render(<DiveTrends yearlyCounts={[]} monthlyStats={buildMonthlyStats()} />);
            expect(screen.getByText(/ログを記録すると統計が表示され/)).toBeInTheDocument();
            expect(screen.getByRole('link', { name: '新しいログを記録' })).toHaveAttribute('href', '/dives/new');
            expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
        });
    });

    describe('集計失敗（null）のとき', () => {
        it('失敗メッセージを表示する', () => {
            render(<DiveTrends yearlyCounts={null} monthlyStats={null} />);
            expect(screen.getByRole('status')).toHaveTextContent('集計に失敗しました');
            expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
        });
    });
});
