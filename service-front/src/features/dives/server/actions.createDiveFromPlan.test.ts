import { beforeEach, describe, expect, it, vi } from 'vitest';

const revalidatePath = vi.fn();
const createClient = vi.fn();

vi.mock('next/cache', () => ({
    revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));
vi.mock('@/shared/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => createClient(...args),
}));

import type { DiveFormValues } from '@/features/dives/schemas/dive.schema';
import { createDiveFromPlan } from './actions';

const buildInput = (overrides: Partial<DiveFormValues> = {}): DiveFormValues =>
    ({
        diveNumber: null,
        diveDate: '2026-06-30',
        entryTime: null,
        exitTime: null,
        location: '伊豆 / 大瀬崎',
        diveSiteId: null,
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

interface SupabaseOptions {
    user?: { id: string } | null;
    plan?: { id: string; planned_on: string } | null;
    planFetchError?: { message: string } | null;
    diveInsert?: { id: string } | null;
    diveInsertError?: { code?: string; message?: string } | null;
    planDeleteError?: { message: string } | null;
    /** delete().select('id') が返す削除行。空配列は「並行操作で削除済み（0 行削除）」を再現 */
    planDeleteRows?: { id: string }[];
}

/** dive_plans（fetch + delete）/ dives（insert）/ dive_log_buddies（sync）を最小モックする */
const buildSupabase = (opts: SupabaseOptions = {}) => {
    const {
        user = { id: 'user-1' },
        plan = { id: 'plan-1', planned_on: '2026-06-30' },
        planFetchError = null,
        diveInsert = { id: 'dive-1' },
        diveInsertError = null,
        planDeleteError = null,
        planDeleteRows = [{ id: 'plan-1' }],
    } = opts;

    // delete().eq('id', ...).eq('user_id', ...).select('id') を await できる削除チェーン
    const deleteChain = {
        eq: vi.fn(() => deleteChain),
        select: vi.fn(async () => ({
            data: planDeleteError ? null : planDeleteRows,
            error: planDeleteError,
        })),
    };

    const divePlansChain = {
        select: vi.fn(() => divePlansChain),
        eq: vi.fn(() => divePlansChain),
        maybeSingle: vi.fn(async () => ({ data: plan, error: planFetchError })),
        delete: vi.fn(() => deleteChain),
    };

    const divesChain = {
        insert: vi.fn(() => divesChain),
        select: vi.fn(() => divesChain),
        single: vi.fn(async () => ({ data: diveInsert, error: diveInsertError })),
    };

    // syncDiveBuddies の既存取得（select().eq().eq() を await）: 空配列を返す thenable チェーン
    const buddiesChain = {
        select: vi.fn(() => buddiesChain),
        eq: vi.fn(() => buddiesChain),
        // biome-ignore lint/suspicious/noThenProperty: テスト用の thenable チェーン
        then: (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null }),
    };

    const from = vi.fn((table: string) => {
        if (table === 'dive_plans') return divePlansChain;
        if (table === 'dives') return divesChain;
        if (table === 'dive_log_buddies') return buddiesChain;
        throw new Error(`unexpected table: ${table}`);
    });

    const client = {
        auth: { getUser: async () => ({ data: { user } }) },
        from,
    };

    return { client, divePlansChain, divesChain, deleteChain };
};

describe('createDiveFromPlan', () => {
    beforeEach(() => {
        revalidatePath.mockReset();
        createClient.mockReset();
    });

    it('当日以前の予定を移動: ログを作成し、成功後に予定を削除する', async () => {
        const { client, divesChain, deleteChain } = buildSupabase();
        createClient.mockResolvedValue(client);

        const result = await createDiveFromPlan('plan-1', buildInput());

        expect(result).toEqual({ success: true, id: 'dive-1' });
        expect(divesChain.insert).toHaveBeenCalled();
        // 所有者条件を含めて削除している（FR-014）
        expect(deleteChain.eq).toHaveBeenCalledWith('id', 'plan-1');
        expect(deleteChain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    });

    it('予定が存在しない場合はログを作成せず失敗を返す（FR-015）', async () => {
        const { client, divesChain, divePlansChain } = buildSupabase({ plan: null });
        createClient.mockResolvedValue(client);

        const result = await createDiveFromPlan('plan-1', buildInput());

        expect(result).toEqual({ success: false, error: 'この予定は既に移動済みか削除されています' });
        expect(divesChain.insert).not.toHaveBeenCalled();
        expect(divePlansChain.delete).not.toHaveBeenCalled();
    });

    it('ログ作成に失敗した場合は予定を削除しない（FR-010）', async () => {
        const { client, divePlansChain } = buildSupabase({ diveInsert: null, diveInsertError: { message: 'boom' } });
        createClient.mockResolvedValue(client);

        const result = await createDiveFromPlan('plan-1', buildInput());

        expect(result.success).toBe(false);
        expect(divePlansChain.delete).not.toHaveBeenCalled();
    });

    it('ログ作成成功後に予定削除が失敗した場合はログを保持し planDeleteFailed を返す（FR-011a）', async () => {
        const { client } = buildSupabase({ planDeleteError: { message: 'delete failed' } });
        createClient.mockResolvedValue(client);

        const result = await createDiveFromPlan('plan-1', buildInput());

        expect(result).toEqual({ success: true, id: 'dive-1', planDeleteFailed: true });
    });

    it('削除が 0 行（並行タブが先に移動済み）の場合も成功と誤認せず planDeleteFailed を返す（FR-015）', async () => {
        const { client } = buildSupabase({ planDeleteRows: [] });
        createClient.mockResolvedValue(client);

        const result = await createDiveFromPlan('plan-1', buildInput());

        expect(result).toEqual({ success: true, id: 'dive-1', planDeleteFailed: true });
    });

    it('未来日の予定はサーバー側で拒否し、ログを作成しない（FR-002）', async () => {
        const { client, divesChain, divePlansChain } = buildSupabase({
            plan: { id: 'plan-1', planned_on: '2999-12-31' },
        });
        createClient.mockResolvedValue(client);

        const result = await createDiveFromPlan('plan-1', buildInput());

        expect(result).toEqual({
            success: false,
            error: '未来の予定はログに移動できません。予定日を過ぎてから移動してください',
        });
        expect(divesChain.insert).not.toHaveBeenCalled();
        expect(divePlansChain.delete).not.toHaveBeenCalled();
    });

    it('未認証のときは失敗を返す（FR-014）', async () => {
        const { client, divePlansChain } = buildSupabase({ user: null });
        createClient.mockResolvedValue(client);

        const result = await createDiveFromPlan('plan-1', buildInput());

        expect(result).toEqual({ success: false, error: 'ログインが必要です' });
        expect(divePlansChain.maybeSingle).not.toHaveBeenCalled();
    });
});
