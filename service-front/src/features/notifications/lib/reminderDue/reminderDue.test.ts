import { describe, expect, it } from 'vitest';

import { getOverhaulDueDate, isPlanDueToday } from './reminderDue';

describe('isPlanDueToday', () => {
    it('予定日 = 今日 かつ 当日以前の登録なら true', () => {
        expect(
            isPlanDueToday({ plannedOn: '2026-07-02', createdAt: '2026-07-01T10:00:00Z', today: '2026-07-02' }),
        ).toBe(true);
    });

    it('予定日が今日でなければ false', () => {
        expect(
            isPlanDueToday({ plannedOn: '2026-07-03', createdAt: '2026-07-01T10:00:00Z', today: '2026-07-02' }),
        ).toBe(false);
    });

    it('過去日で登録された予定（登録日 > 予定日）は対象外（FR-009）', () => {
        expect(
            isPlanDueToday({ plannedOn: '2026-07-01', createdAt: '2026-07-02T10:00:00Z', today: '2026-07-01' }),
        ).toBe(false);
    });

    it('当日に登録した当日予定は対象（登録日 = 予定日）', () => {
        // 登録日時は JST で当日（UTC では前日 23:00 だが JST 8:00）
        expect(
            isPlanDueToday({ plannedOn: '2026-07-02', createdAt: '2026-07-01T23:00:00Z', today: '2026-07-02' }),
        ).toBe(true);
    });
});

describe('getOverhaulDueDate', () => {
    it('期限到来（期限日 <= 今日）なら期限日を返す', () => {
        // 2025-06-01 + 12 ヶ月 = 2026-06-01 <= 今日
        expect(
            getOverhaulDueDate({
                lastOverhauledOn: '2025-06-01',
                intervalMonths: 12,
                intervalDives: 100,
                today: '2026-07-02',
            }),
        ).toBe('2026-06-01');
    });

    it('期限前なら null を返す', () => {
        expect(
            getOverhaulDueDate({
                lastOverhauledOn: '2026-06-01',
                intervalMonths: 12,
                intervalDives: 100,
                today: '2026-07-02',
            }),
        ).toBeNull();
    });

    it('月末丸め（1/31 + 1 ヶ月 → 2 月末日）を overhaul の計算に委譲する', () => {
        expect(
            getOverhaulDueDate({
                lastOverhauledOn: '2026-01-31',
                intervalMonths: 1,
                intervalDives: 100,
                today: '2026-03-01',
            }),
        ).toBe('2026-02-28');
    });
});
