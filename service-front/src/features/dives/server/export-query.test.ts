import type { Database } from '@repo/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/supabase/server', () => ({ createClient: vi.fn() }));

import { EXPORT_MAX_ROWS, fetchDivesForExport } from './export-query';

const buildRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'd1',
    user_id: 'u1',
    dive_number: 1,
    dive_date: '2026-06-01',
    location: '大瀬崎',
    max_depth_m: 18.5,
    bottom_time_min: 45,
    certification_dive: false,
    is_public: false,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    dive_site: null,
    ...overrides,
});

interface QueryResult {
    data: unknown[] | null;
    error: { message: string } | null;
}

const createMockClient = (result: QueryResult) => {
    const builder = {
        select: vi.fn(),
        order: vi.fn(),
        limit: vi.fn(),
        in: vi.fn(),
        eq: vi.fn(),
        gte: vi.fn(),
        lte: vi.fn(),
        not: vi.fn(),
        ilike: vi.fn(),
        or: vi.fn(),
        // biome-ignore lint/suspicious/noThenProperty: Supabase クエリビルダーは thenable のためモックでも then を実装する
        then: (resolve: (value: QueryResult) => void) => resolve(result),
    };
    for (const method of ['select', 'order', 'limit', 'in', 'eq', 'gte', 'lte', 'not', 'ilike', 'or'] as const) {
        builder[method].mockReturnValue(builder);
    }
    const from = vi.fn(() => builder);
    return { client: { from } as unknown as SupabaseClient<Database>, from, builder };
};

describe('fetchDivesForExport', () => {
    it('全カラムを日付・id 降順で最大件数まで取得する', async () => {
        const { client, from, builder } = createMockClient({ data: [buildRow()], error: null });

        const dives = await fetchDivesForExport(client);

        expect(from).toHaveBeenCalledWith('dives');
        expect(builder.order).toHaveBeenNthCalledWith(1, 'dive_date', { ascending: false });
        expect(builder.order).toHaveBeenNthCalledWith(2, 'id', { ascending: false });
        expect(builder.limit).toHaveBeenCalledWith(EXPORT_MAX_ROWS);
        expect(dives).toHaveLength(1);
        expect(dives[0]?.id).toBe('d1');
    });

    it('ids 指定時は in 句で絞り、フィルタは適用しない', async () => {
        const { client, builder } = createMockClient({ data: [], error: null });

        await fetchDivesForExport(client, { ids: ['a', 'b'], filter: { diveType: 'boat' } });

        expect(builder.in).toHaveBeenCalledWith('id', ['a', 'b']);
        expect(builder.eq).not.toHaveBeenCalledWith('dive_type', 'boat');
    });

    it('ownerId 指定時は user_id で本人のログに絞る（他人の公開ログの ids エクスポートを弾く）', async () => {
        const { client, builder } = createMockClient({ data: [], error: null });

        await fetchDivesForExport(client, { ids: ['a'], ownerId: 'u1' });

        expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1');
    });

    it('ids 未指定時はフィルタ（期間）を適用する', async () => {
        const { client, builder } = createMockClient({ data: [], error: null });

        await fetchDivesForExport(client, { filter: { dateFrom: '2025-01-01', dateTo: '2025-12-31' } });

        expect(builder.in).not.toHaveBeenCalled();
        expect(builder.gte).toHaveBeenCalledWith('dive_date', '2025-01-01');
        expect(builder.lte).toHaveBeenCalledWith('dive_date', '2025-12-31');
    });

    it('numeric の string を数値へ正規化して Dive にマップする', async () => {
        const { client } = createMockClient({
            data: [buildRow({ max_depth_m: '30.5', water_temp_c: '21.0' })],
            error: null,
        });

        const dives = await fetchDivesForExport(client);

        expect(dives[0]?.maxDepthM).toBe(30.5);
        expect(dives[0]?.waterTempC).toBe(21);
    });

    it('Supabase エラー時は throw する', async () => {
        const { client } = createMockClient({ data: null, error: { message: 'permission denied' } });

        await expect(fetchDivesForExport(client)).rejects.toThrow(/permission denied/);
    });
});
