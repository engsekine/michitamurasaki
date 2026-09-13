import { render, screen } from '@testing-library/react';

import {
    getMonthlyDiveStats,
    getPrimaryRegulatorStatus,
    getYearlyDiveCounts,
} from '@/features/dashboard/server/queries';

import { TopDashboard } from './TopDashboard';

// Server Component のデータ取得をモックして組み立てだけ検証する
vi.mock('@/features/dashboard/server/queries', () => ({
    getYearlyDiveCounts: vi.fn(),
    getMonthlyDiveStats: vi.fn(),
    getPrimaryRegulatorStatus: vi.fn(),
}));

const renderTopDashboard = async (props: Parameters<typeof TopDashboard>[0] = { recentDives: [] }) => {
    // 非同期 Server Component は解決済みの要素として render する
    render(await TopDashboard(props));
};

const mockHappyPath = () => {
    vi.mocked(getYearlyDiveCounts).mockResolvedValue([{ year: 2026, diveCount: 11 }]);
    vi.mocked(getMonthlyDiveStats).mockResolvedValue([{ month: '2026-06', diveCount: 2 }]);
    vi.mocked(getPrimaryRegulatorStatus).mockResolvedValue(null);
};

describe('TopDashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockHappyPath();
    });

    it('design/req.md の順（次の予定 → 最近のログ → タイムライン → OH → 累計ダイビング本数）でセクションを表示する', async () => {
        await renderTopDashboard({
            recentDives: [],
            nextPlanSection: <section aria-label="next-plan-slot">次の予定スロット</section>,
            timelineSection: <section aria-label="timeline-slot">タイムラインスロット</section>,
        });

        const headings = screen.getAllByRole('heading', { level: 2 }).map((el) => el.textContent);
        expect(headings).toEqual(['最近のダイブログ', 'レギュレーター OH 状況', '累計ダイビング本数']);

        const html = document.body.innerHTML;
        const order = [
            html.indexOf('次の予定スロット'),
            html.indexOf('最近のダイブログ'),
            html.indexOf('タイムラインスロット'),
            html.indexOf('レギュレーター OH 状況'),
            html.indexOf('累計ダイビング本数'),
        ];
        expect([...order].every((v, i) => v >= 0 && (i === 0 || v > (order[i - 1] ?? 0)))).toBe(true);
    });

    it('ヒーロー・累計統計は表示しない（FV = DashboardHero へ移管済み）', async () => {
        await renderTopDashboard();

        expect(screen.queryByText(/ようこそ/)).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: '累計統計' })).not.toBeInTheDocument();
    });

    it('推移の集計が失敗してもページは落ちず、エラーメッセージを表示する', async () => {
        vi.mocked(getYearlyDiveCounts).mockRejectedValue(new Error('boom'));
        // テスト出力を汚さないよう console.error を黙らせる
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        await renderTopDashboard();

        expect(screen.getByRole('heading', { level: 2, name: '累計ダイビング本数' })).toBeInTheDocument();
        expect(screen.getByText(/集計に失敗しました/)).toBeInTheDocument();
        consoleError.mockRestore();
    });
});
