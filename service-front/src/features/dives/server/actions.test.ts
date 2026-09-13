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
import { createDive, updateDive } from './actions';

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
        diveShopId: null,
        ...overrides,
    }) as DiveFormValues;

/** 認証済みユーザーのみ返し、DB アクセスが起きたら記録するモック */
const buildSupabase = () => {
    const from = vi.fn();
    createClient.mockResolvedValue({
        auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
        from,
    });
    return { from };
};

beforeEach(() => {
    vi.clearAllMocks();
});

/**
 * Server Action は任意クライアントから直接呼べるため、クライアントの yupResolver を通らない
 * payload（スキーマ違反・型不一致）が DB に到達しないことを確認する。
 */
describe('createDive のサーバー側再検証', () => {
    it('平均水深が最大水深を超える入力は DB に触れずに失敗する', async () => {
        const { from } = buildSupabase();

        const result = await createDive(buildInput({ maxDepthM: 10, avgDepthM: 20 }));

        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toBe('平均水深は最大水深以下で入力してください');
        expect(from).not.toHaveBeenCalled();
    });

    it('スキーマ上限を超える値（水温 999℃）は失敗する', async () => {
        const { from } = buildSupabase();

        const result = await createDive(buildInput({ waterTempC: 999 }));

        expect(result.success).toBe(false);
        expect(from).not.toHaveBeenCalled();
    });

    it('型不一致の payload（buddies に数値）は TypeError にならず失敗を返す', async () => {
        const { from } = buildSupabase();

        const result = await createDive(buildInput({ buddies: 5 as unknown as DiveFormValues['buddies'] }));

        expect(result.success).toBe(false);
        expect(from).not.toHaveBeenCalled();
    });
});

describe('updateDive のサーバー側再検証', () => {
    it('終了残圧が開始残圧を超える入力は DB に触れずに失敗する', async () => {
        const { from } = buildSupabase();

        const result = await updateDive('dive-1', buildInput({ pressureStartBar: 100, pressureEndBar: 150 }));

        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toBe('終了残圧は開始残圧以下で入力してください');
        expect(from).not.toHaveBeenCalled();
    });
});
