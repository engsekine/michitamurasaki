import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireUser = vi.fn();
const maybeSingle = vi.fn();

/** update().eq() の呼び出し記録（テーブル名・payload・eq 引数） */
interface UpdateCall {
    table: string;
    payload: Record<string, unknown>;
    eqArgs: [string, unknown];
}
let updateCalls: UpdateCall[] = [];
let updateError: { message: string } | null = null;

const from = vi.fn((table: string) => ({
    select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })),
    update: vi.fn((payload: Record<string, unknown>) => ({
        eq: vi.fn((column: string, value: unknown) => {
            updateCalls.push({ table, payload, eqArgs: [column, value] });
            return Promise.resolve({ error: updateError });
        }),
    })),
}));

vi.mock('@/shared/lib/supabase/server', () => ({
    createClient: async () => ({ from }),
}));
vi.mock('@/shared/lib/auth', () => ({
    requireUser: (...args: unknown[]) => requireUser(...args),
}));
vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));
vi.mock('@/shared/lib/date', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/shared/lib/date')>()),
    todayInJst: () => '2026-08-07',
}));

import { addPackingItem, completePacking, createPlan, toggleConfirmItem, uncompletePacking } from './actions';

/** completePacking が取得する予定 row のビルダー */
const buildPlanRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'plan-1',
    planned_on: '2026-08-10',
    packing_completed_at: null,
    plan_packing_items: [{ id: 'item-1' }, { id: 'item-2' }],
    ...overrides,
});

beforeEach(() => {
    vi.clearAllMocks();
    updateCalls = [];
    updateError = null;
    requireUser.mockResolvedValue({ user: { id: 'user-1' }, failure: null });
});

describe('completePacking', () => {
    it('未完了の予定を完了にする（packing_completed_at を設定）', async () => {
        maybeSingle.mockResolvedValue({ data: buildPlanRow(), error: null });

        const result = await completePacking('plan-1');

        expect(result).toEqual({ success: true });
        expect(updateCalls).toHaveLength(1);
        const [updateCall] = updateCalls;
        expect(updateCall?.table).toBe('dive_plans');
        expect(updateCall?.eqArgs).toEqual(['id', 'plan-1']);
        // ISO 形式の日時が設定される
        expect(typeof updateCall?.payload['packing_completed_at']).toBe('string');
    });

    it('予定日が今日でも完了できる（当日の準備を想定）', async () => {
        maybeSingle.mockResolvedValue({ data: buildPlanRow({ planned_on: '2026-08-07' }), error: null });

        const result = await completePacking('plan-1');

        expect(result).toEqual({ success: true });
    });

    it('終了済み（予定日が過去）の予定は完了できない（FR-009）', async () => {
        maybeSingle.mockResolvedValue({ data: buildPlanRow({ planned_on: '2026-08-06' }), error: null });

        const result = await completePacking('plan-1');

        expect(result.success).toBe(false);
        expect(updateCalls).toHaveLength(0);
    });

    it('持ち物が 0 件の予定は完了できない（FR-007）', async () => {
        maybeSingle.mockResolvedValue({ data: buildPlanRow({ plan_packing_items: [] }), error: null });

        const result = await completePacking('plan-1');

        expect(result.success).toBe(false);
        expect(updateCalls).toHaveLength(0);
    });

    it('予定が見つからない（他人の予定含む・RLS で不可視）場合は失敗を返す', async () => {
        maybeSingle.mockResolvedValue({ data: null, error: null });

        const result = await completePacking('plan-x');

        expect(result.success).toBe(false);
        expect(updateCalls).toHaveLength(0);
    });

    it('完了済みへの再実行は状態を変えず成功を返す（冪等）', async () => {
        maybeSingle.mockResolvedValue({
            data: buildPlanRow({ packing_completed_at: '2026-08-07T00:00:00Z' }),
            error: null,
        });

        const result = await completePacking('plan-1');

        expect(result).toEqual({ success: true });
        expect(updateCalls).toHaveLength(0);
    });

    it('未認証なら requireUser の失敗をそのまま返す', async () => {
        const failure = { success: false as const, error: 'ログインしてください' };
        requireUser.mockResolvedValue({ user: null, failure });

        const result = await completePacking('plan-1');

        expect(result).toEqual(failure);
        expect(from).not.toHaveBeenCalled();
    });
});

describe('toggleConfirmItem', () => {
    /** toggleConfirmItem が取得する項目 row のビルダー（親予定を join） */
    const buildItemRow = (overrides: Record<string, unknown> = {}) => ({
        id: 'item-1',
        dive_plans: {
            id: 'plan-1',
            planned_on: '2026-08-10',
            packing_completed_at: '2026-08-07T00:00:00Z',
        },
        ...overrides,
    });

    it('完了中の予定の項目の確認状態を切り替える（FR-006）', async () => {
        maybeSingle.mockResolvedValue({ data: buildItemRow(), error: null });

        const result = await toggleConfirmItem('item-1', true);

        expect(result).toEqual({ success: true });
        expect(updateCalls).toHaveLength(1);
        const [updateCall] = updateCalls;
        expect(updateCall?.table).toBe('plan_packing_items');
        expect(updateCall?.payload).toEqual({ is_confirmed: true });
        expect(updateCall?.eqArgs).toEqual(['id', 'item-1']);
    });

    it('未完了の予定の項目は確認操作できない', async () => {
        maybeSingle.mockResolvedValue({
            data: buildItemRow({
                dive_plans: { id: 'plan-1', planned_on: '2026-08-10', packing_completed_at: null },
            }),
            error: null,
        });

        const result = await toggleConfirmItem('item-1', true);

        expect(result.success).toBe(false);
        expect(updateCalls).toHaveLength(0);
    });

    it('終了済み予定の項目は確認操作できない（FR-009）', async () => {
        maybeSingle.mockResolvedValue({
            data: buildItemRow({
                dive_plans: {
                    id: 'plan-1',
                    planned_on: '2026-08-06',
                    packing_completed_at: '2026-08-01T00:00:00Z',
                },
            }),
            error: null,
        });

        const result = await toggleConfirmItem('item-1', true);

        expect(result.success).toBe(false);
        expect(updateCalls).toHaveLength(0);
    });

    it('項目が見つからない（他人の項目含む）場合は失敗を返す', async () => {
        maybeSingle.mockResolvedValue({ data: null, error: null });

        const result = await toggleConfirmItem('item-x', true);

        expect(result.success).toBe(false);
        expect(updateCalls).toHaveLength(0);
    });
});

describe('uncompletePacking', () => {
    const buildPlanRowForUncomplete = (overrides: Record<string, unknown> = {}) => ({
        id: 'plan-1',
        planned_on: '2026-08-10',
        packing_completed_at: '2026-08-07T00:00:00Z',
        plan_packing_items: [{ id: 'item-1' }],
        ...overrides,
    });

    it('完了を解除し、忘れ物確認の状態を全件リセットする（FR-005 / Q1）', async () => {
        maybeSingle.mockResolvedValue({ data: buildPlanRowForUncomplete(), error: null });

        const result = await uncompletePacking('plan-1');

        expect(result).toEqual({ success: true });
        // dive_plans の解除 + plan_packing_items の is_confirmed リセットの 2 回
        expect(updateCalls).toHaveLength(2);
        const planUpdate = updateCalls.find((call) => call.table === 'dive_plans');
        expect(planUpdate?.payload).toEqual({ packing_completed_at: null });
        expect(planUpdate?.eqArgs).toEqual(['id', 'plan-1']);
        const itemsUpdate = updateCalls.find((call) => call.table === 'plan_packing_items');
        expect(itemsUpdate?.payload).toEqual({ is_confirmed: false });
        expect(itemsUpdate?.eqArgs).toEqual(['plan_id', 'plan-1']);
    });

    it('is_checked（準備チェック）には触れない（FR-005）', async () => {
        maybeSingle.mockResolvedValue({ data: buildPlanRowForUncomplete(), error: null });

        await uncompletePacking('plan-1');

        for (const call of updateCalls) {
            expect(call.payload).not.toHaveProperty('is_checked');
        }
    });

    it('未完了の予定への解除は状態を変えず成功を返す（冪等）', async () => {
        maybeSingle.mockResolvedValue({
            data: buildPlanRowForUncomplete({ packing_completed_at: null }),
            error: null,
        });

        const result = await uncompletePacking('plan-1');

        expect(result).toEqual({ success: true });
        expect(updateCalls).toHaveLength(0);
    });

    it('予定が見つからない（他人の予定含む）場合は失敗を返す', async () => {
        maybeSingle.mockResolvedValue({ data: null, error: null });

        const result = await uncompletePacking('plan-x');

        expect(result.success).toBe(false);
        expect(updateCalls).toHaveLength(0);
    });
});

/**
 * Server Action は任意クライアントから直接呼べるため、クライアントの yupResolver を通らない
 * payload（スキーマ違反・型不一致）が DB に到達しないことを確認する。
 */
describe('createPlan / addPackingItem のサーバー側再検証', () => {
    it('createPlan: 日付形式が不正な入力は DB に触れずに失敗する', async () => {
        const result = await createPlan({ plannedOn: 'not-a-date', location: '大瀬崎', notes: null, diveShopId: null });

        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toBe('正しい日付を入力してください');
        expect(from).not.toHaveBeenCalled();
    });

    it('createPlan: ポイント名が空の入力は失敗する', async () => {
        const result = await createPlan({ plannedOn: '2026-08-10', location: '   ', notes: null, diveShopId: null });

        expect(result.success).toBe(false);
        expect(from).not.toHaveBeenCalled();
    });

    it('addPackingItem: 項目名が空・上限超過なら DB に触れずに失敗する', async () => {
        expect((await addPackingItem('plan-1', '   ')).success).toBe(false);
        expect((await addPackingItem('plan-1', 'あ'.repeat(500))).success).toBe(false);
        expect(from).not.toHaveBeenCalled();
    });
});
