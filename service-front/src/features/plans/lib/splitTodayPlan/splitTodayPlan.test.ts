import type { NextPlanSummary } from '@/features/plans/types';

import { splitTodayPlan } from './splitTodayPlan';

const makePlan = (overrides: Partial<NextPlanSummary>): NextPlanSummary => ({
    id: 'plan-1',
    plannedOn: '2026-08-07',
    location: '伊豆・大瀬崎',
    notes: null,
    daysUntil: 0,
    packingItems: [],
    packingCompletedAt: null,
    ...overrides,
});

describe('splitTodayPlan', () => {
    it('先頭の予定が当日（daysUntil = 0）なら todayPlan として切り出す', () => {
        const today = makePlan({ id: 'plan-today', daysUntil: 0 });
        const future = makePlan({ id: 'plan-future', plannedOn: '2026-08-20', daysUntil: 13 });

        const result = splitTodayPlan([today, future]);

        expect(result.todayPlan).toEqual(today);
        expect(result.upcomingPlans).toEqual([future]);
    });

    it('先頭の予定が将来日なら todayPlan は null で全件を upcomingPlans に返す', () => {
        const future1 = makePlan({ id: 'plan-1', plannedOn: '2026-08-20', daysUntil: 13 });
        const future2 = makePlan({ id: 'plan-2', plannedOn: '2026-09-01', daysUntil: 25 });

        const result = splitTodayPlan([future1, future2]);

        expect(result.todayPlan).toBeNull();
        expect(result.upcomingPlans).toEqual([future1, future2]);
    });

    it('当日の予定が複数ある場合、2 件目以降は upcomingPlans に残す（予定を落とさない）', () => {
        const today1 = makePlan({ id: 'plan-today-1', daysUntil: 0 });
        const today2 = makePlan({ id: 'plan-today-2', daysUntil: 0 });

        const result = splitTodayPlan([today1, today2]);

        expect(result.todayPlan).toEqual(today1);
        expect(result.upcomingPlans).toEqual([today2]);
    });

    it('予定が空なら todayPlan は null・upcomingPlans は空配列を返す', () => {
        const result = splitTodayPlan([]);

        expect(result.todayPlan).toBeNull();
        expect(result.upcomingPlans).toEqual([]);
    });
});
