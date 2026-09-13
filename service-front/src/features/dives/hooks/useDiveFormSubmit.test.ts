import { act, renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const createDive = vi.fn();
const createDiveFromPlan = vi.fn();
const updateDive = vi.fn();
const routerPush = vi.fn();
const routerRefresh = vi.fn();

vi.mock('@/features/dives/server/actions', () => ({
    createDive: (...args: unknown[]) => createDive(...args),
    createDiveFromPlan: (...args: unknown[]) => createDiveFromPlan(...args),
    updateDive: (...args: unknown[]) => updateDive(...args),
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: routerPush, refresh: routerRefresh }),
}));

import type { DiveFormValues } from '@/features/dives/schemas/dive.schema';
import { useDiveFormSubmit } from './useDiveFormSubmit';

const buildValues = (overrides: Partial<DiveFormValues> = {}): DiveFormValues =>
    ({
        diveNumber: null,
        diveDate: '2026-04-15',
        entryTime: null,
        exitTime: null,
        location: '伊豆',
        diveType: null,
        weather: null,
        airTempC: null,
        waterTempC: null,
        visibilityM: null,
        wave: null,
        currentCondition: null,
        maxDepthM: 18,
        avgDepthM: null,
        bottomTimeMin: 45,
        tankType: null,
        tankVolumeL: null,
        gasType: null,
        o2Percent: null,
        pressureStartBar: null,
        pressureEndBar: null,
        weightKg: null,
        suitType: null,
        equipmentNotes: null,
        buddyName: null,
        instructorName: null,
        certificationDive: false,
        notes: null,
        buddies: [],
        isPublic: false,
        ...overrides,
    }) as DiveFormValues;

describe('useDiveFormSubmit', () => {
    beforeEach(() => {
        createDive.mockReset();
        updateDive.mockReset();
        createDiveFromPlan.mockReset();
        routerPush.mockReset();
        routerRefresh.mockReset();
    });

    it('diveId 未指定（新規作成）で submit すると createDive を呼び詳細ページへ遷移する', async () => {
        createDive.mockResolvedValueOnce({ success: true, id: 'new-id' });
        const { result } = renderHook(() => useDiveFormSubmit());

        act(() => {
            result.current.submit(buildValues());
        });

        await waitFor(() => {
            expect(routerPush).toHaveBeenCalledWith('/dives/new-id');
        });
        expect(createDive).toHaveBeenCalled();
        expect(updateDive).not.toHaveBeenCalled();
        expect(routerRefresh).toHaveBeenCalled();
        expect(result.current.serverError).toBeNull();
    });

    it('createDive がエラーを返すと serverError に反映する', async () => {
        createDive.mockResolvedValueOnce({ success: false, error: '作成に失敗しました' });
        const { result } = renderHook(() => useDiveFormSubmit());

        act(() => {
            result.current.submit(buildValues());
        });

        await waitFor(() => {
            expect(result.current.serverError).toBe('作成に失敗しました');
        });
        expect(routerPush).not.toHaveBeenCalled();
    });

    it('diveId 指定時は updateDive を呼び詳細ページへ遷移する', async () => {
        updateDive.mockResolvedValueOnce({ success: true });
        const { result } = renderHook(() => useDiveFormSubmit('existing-id'));

        act(() => {
            result.current.submit(buildValues());
        });

        await waitFor(() => {
            expect(routerPush).toHaveBeenCalledWith('/dives/existing-id');
        });
        expect(updateDive).toHaveBeenCalledWith('existing-id', expect.any(Object));
        expect(createDive).not.toHaveBeenCalled();
    });

    it('updateDive がエラーを返すと serverError に反映し遷移しない', async () => {
        updateDive.mockResolvedValueOnce({ success: false, error: '更新に失敗しました' });
        const { result } = renderHook(() => useDiveFormSubmit('existing-id'));

        act(() => {
            result.current.submit(buildValues());
        });

        await waitFor(() => {
            expect(result.current.serverError).toBe('更新に失敗しました');
        });
        expect(routerPush).not.toHaveBeenCalled();
    });

    it('編集で buddyWarning が返ると serverWarning に反映し詳細へ遷移しない', async () => {
        updateDive.mockResolvedValueOnce({ success: true, buddyWarning: 'バディ保存に一部失敗' });
        const { result } = renderHook(() => useDiveFormSubmit('existing-id'));

        act(() => {
            result.current.submit(buildValues());
        });

        await waitFor(() => {
            expect(result.current.serverWarning).toBe('バディ保存に一部失敗');
        });
        expect(routerPush).not.toHaveBeenCalled();
        expect(routerRefresh).toHaveBeenCalled();
    });

    it('新規作成で buddyWarning が返っても本体は作成済みのため詳細へ遷移する', async () => {
        createDive.mockResolvedValueOnce({ success: true, id: 'new-id', buddyWarning: 'バディ保存に一部失敗' });
        const { result } = renderHook(() => useDiveFormSubmit());

        act(() => {
            result.current.submit(buildValues());
        });

        await waitFor(() => {
            expect(routerPush).toHaveBeenCalledWith('/dives/new-id');
        });
    });

    it('fromPlanId 指定時は createDiveFromPlan を呼び、詳細ページへ遷移する（024 US1）', async () => {
        createDiveFromPlan.mockResolvedValueOnce({ success: true, id: 'moved-id' });
        const { result } = renderHook(() => useDiveFormSubmit(undefined, 'plan-1'));

        act(() => {
            result.current.submit(buildValues());
        });

        await waitFor(() => {
            expect(routerPush).toHaveBeenCalledWith('/dives/moved-id');
        });
        expect(createDiveFromPlan).toHaveBeenCalledWith('plan-1', expect.any(Object));
        expect(createDive).not.toHaveBeenCalled();
    });

    it('移動でログ作成成功だが予定削除に失敗した場合は planDeleteFailed クエリ付きで遷移する（024 FR-011a）', async () => {
        createDiveFromPlan.mockResolvedValueOnce({ success: true, id: 'moved-id', planDeleteFailed: true });
        const { result } = renderHook(() => useDiveFormSubmit(undefined, 'plan-1'));

        act(() => {
            result.current.submit(buildValues());
        });

        await waitFor(() => {
            expect(routerPush).toHaveBeenCalledWith('/dives/moved-id?planDeleteFailed=1');
        });
    });

    it('移動が失敗した場合は serverError を表示し遷移しない（024 FR-010 / FR-015）', async () => {
        createDiveFromPlan.mockResolvedValueOnce({
            success: false,
            error: 'この予定は既に移動済みか削除されています',
        });
        const { result } = renderHook(() => useDiveFormSubmit(undefined, 'plan-1'));

        act(() => {
            result.current.submit(buildValues());
        });

        await waitFor(() => {
            expect(result.current.serverError).toBe('この予定は既に移動済みか削除されています');
        });
        expect(routerPush).not.toHaveBeenCalled();
    });

    it("code='no_credit' の失敗は serverError ではなく noCredit を立てる（026 FR-002）", async () => {
        createDive.mockResolvedValueOnce({
            success: false,
            error: 'ログ枠がないため作成できません',
            code: 'no_credit',
        });
        const { result } = renderHook(() => useDiveFormSubmit());

        act(() => {
            result.current.submit(buildValues());
        });

        await waitFor(() => {
            expect(result.current.noCredit).toBe(true);
        });
        expect(result.current.serverError).toBeNull();
        expect(routerPush).not.toHaveBeenCalled();
    });

    it('再 submit で noCredit はリセットされる（026）', async () => {
        createDive
            .mockResolvedValueOnce({ success: false, error: 'ログ枠がないため作成できません', code: 'no_credit' })
            .mockResolvedValueOnce({ success: true, id: 'new-id' });
        const { result } = renderHook(() => useDiveFormSubmit());

        act(() => {
            result.current.submit(buildValues());
        });
        await waitFor(() => {
            expect(result.current.noCredit).toBe(true);
        });

        act(() => {
            result.current.submit(buildValues());
        });
        await waitFor(() => {
            expect(routerPush).toHaveBeenCalledWith('/dives/new-id');
        });
        expect(result.current.noCredit).toBe(false);
    });

    it('予定→ログ移動でも no_credit を判別する（026 FR-012）', async () => {
        createDiveFromPlan.mockResolvedValueOnce({
            success: false,
            error: 'ログ枠がないため作成できません',
            code: 'no_credit',
        });
        const { result } = renderHook(() => useDiveFormSubmit(undefined, 'plan-1'));

        act(() => {
            result.current.submit(buildValues());
        });

        await waitFor(() => {
            expect(result.current.noCredit).toBe(true);
        });
        expect(routerPush).not.toHaveBeenCalled();
    });
});
