import { render, screen } from '@testing-library/react';

import type { NextPlanSummary } from '@/features/plans/types';

import { NextPlanList } from './NextPlanList';

type NextPlanListItem = Pick<NextPlanSummary, 'id' | 'plannedOn' | 'location' | 'daysUntil'>;

const buildPlan = (overrides: Partial<NextPlanListItem> = {}): NextPlanListItem => ({
    id: 'plan-1',
    plannedOn: '2026-07-12',
    location: '伊豆 / 田子',
    daysUntil: 6,
    ...overrides,
});

describe('NextPlanList', () => {
    it('plans が空のときは空状態のメッセージを表示する', () => {
        render(<NextPlanList plans={[]} />);

        expect(
            screen.getByText('次の予定はまだありません。予定を作成して次のダイビングに備えましょう'),
        ).toBeInTheDocument();
        expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });

    it('各行を予定詳細へのリンクとして表示し、予定日（曜日付き）・行き先を含む', () => {
        render(
            <NextPlanList plans={[buildPlan({ id: 'plan-1', plannedOn: '2026-07-12', location: '伊豆 / 田子' })]} />,
        );

        const link = screen.getByRole('link', { name: /2026\/07\/12（日）.*伊豆 \/ 田子/ });
        expect(link).toHaveAttribute('href', '/plans/plan-1');
    });

    it('daysUntil が 0 のときは「今日」バッジを表示する', () => {
        render(<NextPlanList plans={[buildPlan({ daysUntil: 0 })]} />);

        expect(screen.getByText('今日')).toBeInTheDocument();
    });

    it('daysUntil が正のときは「あと N 日」バッジを表示する', () => {
        render(<NextPlanList plans={[buildPlan({ daysUntil: 6 })]} />);

        expect(screen.getByText('あと 6 日')).toBeInTheDocument();
    });

    it('複数件を渡すと件数分の li が並ぶ', () => {
        render(
            <NextPlanList
                plans={[
                    buildPlan({ id: 'plan-1', plannedOn: '2026-07-12', location: '伊豆 / 田子', daysUntil: 0 }),
                    buildPlan({ id: 'plan-2', plannedOn: '2026-07-20', location: '宮古島', daysUntil: 8 }),
                    buildPlan({ id: 'plan-3', plannedOn: '2026-08-01', location: '大瀬崎', daysUntil: 20 }),
                ]}
            />,
        );

        expect(screen.getAllByRole('listitem')).toHaveLength(3);
        expect(screen.getByRole('link', { name: /宮古島/ })).toHaveAttribute('href', '/plans/plan-2');
        expect(screen.getByRole('link', { name: /大瀬崎/ })).toHaveAttribute('href', '/plans/plan-3');
    });
});
