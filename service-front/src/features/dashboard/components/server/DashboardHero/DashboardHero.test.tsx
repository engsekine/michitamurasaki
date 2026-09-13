import { render, screen } from '@testing-library/react';

import { getDashboardHero, getDiveStats, getYearlyDiveCounts } from '@/features/dashboard/server/queries';

import { DashboardHero } from './DashboardHero';

vi.mock('@/features/dashboard/server/queries', () => ({
    getDashboardHero: vi.fn(),
    getDiveStats: vi.fn(),
    getYearlyDiveCounts: vi.fn(),
}));

vi.mock('@/shared/lib/date', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/shared/lib/date')>()),
    todayInJst: () => '2026-07-07',
}));

const mockHappyPath = () => {
    vi.mocked(getDashboardHero).mockResolvedValue({ nickname: 'たろう', blankDays: 22, lastDiveOn: '2026-06-15' });
    vi.mocked(getDiveStats).mockResolvedValue({
        totalDives: 8,
        totalBottomTimeMin: 350,
        maxDepthM: 32,
        visitedLocations: 6,
    });
    vi.mocked(getYearlyDiveCounts).mockResolvedValue([
        { year: 2025, diveCount: 1 },
        { year: 2026, diveCount: 7 },
    ]);
};

describe('DashboardHero', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockHappyPath();
    });

    it('挨拶と主要統計 4 項目（総ダイブ数 / 今年 / 最大深度 / ブランク）を表示する', async () => {
        render(await DashboardHero({}));

        expect(screen.getByRole('heading', { level: 1, name: 'ようこそ、たろうさん' })).toBeInTheDocument();
        expect(screen.getByText('総ダイブ数')).toBeInTheDocument();
        expect(screen.getByText('8')).toBeInTheDocument();
        expect(screen.getByText('今年のダイブ')).toBeInTheDocument();
        expect(screen.getByText('7')).toBeInTheDocument();
        expect(screen.getByText('最大深度')).toBeInTheDocument();
        expect(screen.getByText('32')).toBeInTheDocument();
        expect(screen.getByText('ブランク')).toBeInTheDocument();
        expect(screen.getByText('22')).toBeInTheDocument();
        expect(screen.getByText('最終潜水日: 2026/06/15')).toBeInTheDocument();
    });

    it('CTA（ログ作成）を表示し、資格管理への導線は表示しない', async () => {
        render(await DashboardHero({}));

        expect(screen.getByRole('link', { name: 'ログを作成' })).toHaveAttribute('href', '/dives/new');
        expect(screen.queryByRole('link', { name: '保有資格を管理' })).not.toBeInTheDocument();
    });

    it('badge スロットを FV 内に表示する', async () => {
        render(await DashboardHero({ badge: <span>残りログ枠 23</span> }));

        expect(screen.getByText('残りログ枠 23')).toBeInTheDocument();
    });

    it('nextPlan を予定詳細へのリンクとして表示する', async () => {
        render(
            await DashboardHero({
                nextPlan: { id: 'plan-1', plannedOn: '2026-07-19', location: '伊豆・大瀬崎', daysUntil: 12 },
            }),
        );

        expect(screen.getByRole('heading', { level: 2, name: '次のダイビング予定' })).toBeInTheDocument();
        const link = screen.getByRole('link', { name: /伊豆・大瀬崎/ });
        expect(link).toHaveAttribute('href', '/plans/plan-1');
        expect(link).toHaveTextContent('2026/07/19（日）');
        expect(link).toHaveTextContent('あと 12 日');
    });

    it('daysUntil が 0 の予定は「今日」と表示する', async () => {
        render(
            await DashboardHero({
                nextPlan: { id: 'plan-1', plannedOn: '2026-07-07', location: '伊豆・大瀬崎', daysUntil: 0 },
            }),
        );

        expect(screen.getByText('今日')).toBeInTheDocument();
    });

    it('todayPlanCard 指定時は見出しが「今日のダイビング予定」になり、カードスロットを表示する', async () => {
        render(
            await DashboardHero({
                todayPlanCard: <div>今日の予定詳細カード</div>,
                nextPlan: { id: 'plan-1', plannedOn: '2026-07-07', location: '伊豆・大瀬崎', daysUntil: 0 },
            }),
        );

        expect(screen.getByRole('heading', { level: 2, name: '今日のダイビング予定' })).toBeInTheDocument();
        expect(screen.getByText('今日の予定詳細カード')).toBeInTheDocument();
        // 簡素カード（予定詳細への 1 行リンク）は詳細カードに置き換わるため表示しない
        expect(screen.queryByRole('heading', { level: 2, name: '次のダイビング予定' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /伊豆・大瀬崎/ })).not.toBeInTheDocument();
    });

    it('todayPlanCard 指定時は予定作成ボタンを表示しない', async () => {
        render(await DashboardHero({ todayPlanCard: <div>今日の予定詳細カード</div> }));

        expect(screen.queryByRole('link', { name: '予定を作成する' })).not.toBeInTheDocument();
    });

    it('予定がなくても見出し・作成ボタンは表示され、空メッセージが出る', async () => {
        render(await DashboardHero({ nextPlan: null }));

        expect(screen.getByRole('heading', { level: 2, name: '次のダイビング予定' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: '予定を作成する' })).toHaveAttribute('href', '/plans/new');
        expect(
            screen.getByText('次の予定はまだありません。予定を作成して次のダイビングに備えましょう'),
        ).toBeInTheDocument();
    });

    it('予定があっても作成ボタンは常に表示する', async () => {
        render(
            await DashboardHero({
                nextPlan: { id: 'plan-1', plannedOn: '2026-07-19', location: '伊豆・大瀬崎', daysUntil: 12 },
            }),
        );

        expect(screen.getByRole('link', { name: '予定を作成する' })).toHaveAttribute('href', '/plans/new');
    });

    it('統計の取得に失敗しても FV は表示され、値は「—」になる', async () => {
        vi.mocked(getDiveStats).mockRejectedValue(new Error('boom'));
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        render(await DashboardHero({}));

        expect(screen.getByRole('heading', { level: 1, name: 'ようこそ、たろうさん' })).toBeInTheDocument();
        expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
        // ブランクは hero 由来なので統計失敗の影響を受けない
        expect(screen.getByText('22')).toBeInTheDocument();
        consoleError.mockRestore();
    });

    it('nickname が null なら「ようこそ」だけを表示し、ログ 0 件なら最終潜水日も出さない', async () => {
        vi.mocked(getDashboardHero).mockResolvedValue({ nickname: null, blankDays: null, lastDiveOn: null });

        render(await DashboardHero({}));

        expect(screen.getByRole('heading', { level: 1, name: 'ようこそ' })).toBeInTheDocument();
        expect(screen.queryByText(/最終潜水日/)).not.toBeInTheDocument();
    });
});
