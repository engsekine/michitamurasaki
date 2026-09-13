import type { Database } from '@repo/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';

import { DIVE_PAGE_SIZE } from '@/features/dives/constants';

import { applyDiveListFilter, DIVE_LIST_COLUMNS, fetchDiveListPage, mapDiveListItem } from './list-query';

const buildRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'd1',
    dive_number: 1,
    dive_date: '2026-06-01',
    location: '伊豆 / 大瀬崎',
    max_depth_m: 18.5,
    bottom_time_min: 45,
    water_temp_c: 22.5,
    visibility_m: 15,
    certification_dive: false,
    ...overrides,
});

interface QueryResult {
    data: unknown[] | null;
    error: { message: string } | null;
}

/** チェーン可能かつ await 可能（thenable）な Supabase クエリビルダーのモック */
const createMockClient = (result: QueryResult) => {
    const builder = {
        select: vi.fn(),
        order: vi.fn(),
        limit: vi.fn(),
        eq: vi.fn(),
        gte: vi.fn(),
        lte: vi.fn(),
        not: vi.fn(),
        ilike: vi.fn(),
        or: vi.fn(),
        // biome-ignore lint/suspicious/noThenProperty: Supabase クエリビルダーは thenable のため、モックでも then を実装する必要がある
        then: (resolve: (value: QueryResult) => void) => resolve(result),
    };
    for (const method of ['select', 'order', 'limit', 'eq', 'gte', 'lte', 'not', 'ilike', 'or'] as const) {
        builder[method].mockReturnValue(builder);
    }
    const from = vi.fn(() => builder);
    // fetchDiveListPage は本人限定のため auth.getUser を呼ぶ。既定でログイン済みユーザーを返す
    const getUser = vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } });
    return {
        client: { from, auth: { getUser } } as unknown as SupabaseClient<Database>,
        from,
        builder,
        getUser,
    };
};

describe('mapDiveListItem', () => {
    it('snake_case の行を camelCase に変換する', () => {
        expect(mapDiveListItem(buildRow() as Parameters<typeof mapDiveListItem>[0])).toEqual({
            id: 'd1',
            diveNumber: 1,
            diveDate: '2026-06-01',
            location: '伊豆 / 大瀬崎',
            diveSite: null,
            maxDepthM: 18.5,
            bottomTimeMin: 45,
            waterTempC: 22.5,
            visibilityM: 15,
            certificationDive: false,
        });
    });

    it('numeric カラムが string で返っても数値に正規化する', () => {
        const row = buildRow({ max_depth_m: '18.5', water_temp_c: '22.5', visibility_m: null });
        const item = mapDiveListItem(row as Parameters<typeof mapDiveListItem>[0]);

        expect(item.maxDepthM).toBe(18.5);
        expect(item.waterTempC).toBe(22.5);
        expect(item.visibilityM).toBeNull();
    });
});

describe('fetchDiveListPage', () => {
    it('dives から一覧列を日付・id 降順で limit + 1 件取得する', async () => {
        const { client, from, builder } = createMockClient({ data: [buildRow()], error: null });

        const page = await fetchDiveListPage(client);

        expect(from).toHaveBeenCalledWith('dives');
        expect(builder.select).toHaveBeenCalledWith(DIVE_LIST_COLUMNS);
        expect(builder.order).toHaveBeenNthCalledWith(1, 'dive_date', { ascending: false });
        expect(builder.order).toHaveBeenNthCalledWith(2, 'id', { ascending: false });
        expect(builder.limit).toHaveBeenCalledWith(DIVE_PAGE_SIZE + 1);
        expect(page.items).toHaveLength(1);
        expect(page.nextCursor).toBeNull();
    });

    it('番号・ポイント名フィルタをクエリに反映する', async () => {
        const { client, builder } = createMockClient({ data: [], error: null });

        await fetchDiveListPage(client, {
            filter: { diveNumber: 42, location: '伊豆' },
        });

        expect(builder.eq).toHaveBeenCalledWith('dive_number', 42);
        // ポイント名検索（FR-013）: サイト名 ilike でサイト ID を引き、location とサイト名を or で合流する
        expect(builder.ilike).toHaveBeenCalledWith('name', '%伊豆%');
        expect(builder.or).toHaveBeenCalledWith('location.ilike.*伊豆*');
    });

    it('期間フィルタを gte / lte で反映する（FR-001）', async () => {
        const { client, builder } = createMockClient({ data: [], error: null });

        await fetchDiveListPage(client, { filter: { dateFrom: '2025-07-01', dateTo: '2025-08-31' } });

        expect(builder.gte).toHaveBeenCalledWith('dive_date', '2025-07-01');
        expect(builder.lte).toHaveBeenCalledWith('dive_date', '2025-08-31');
    });

    it('期間の片側のみ指定は開いた範囲になる', async () => {
        const { client, builder } = createMockClient({ data: [], error: null });

        await fetchDiveListPage(client, { filter: { dateFrom: '2025-07-01' } });

        expect(builder.gte).toHaveBeenCalledWith('dive_date', '2025-07-01');
        expect(builder.lte).not.toHaveBeenCalledWith('dive_date', expect.anything());
    });

    it('深度範囲を gte / lte で反映し、未記録（null）を除外する（FR-002 / Q1）', async () => {
        const { client, builder } = createMockClient({ data: [], error: null });

        await fetchDiveListPage(client, { filter: { depthMin: 18, depthMax: 40 } });

        expect(builder.gte).toHaveBeenCalledWith('max_depth_m', 18);
        expect(builder.lte).toHaveBeenCalledWith('max_depth_m', 40);
        expect(builder.not).toHaveBeenCalledWith('max_depth_m', 'is', null);
    });

    it('深度は片側のみ指定でも未記録（null）を除外する', async () => {
        const { client, builder } = createMockClient({ data: [], error: null });

        await fetchDiveListPage(client, { filter: { depthMin: 30 } });

        expect(builder.gte).toHaveBeenCalledWith('max_depth_m', 30);
        expect(builder.not).toHaveBeenCalledWith('max_depth_m', 'is', null);
    });

    it('深度未指定のときは null 除外しない', async () => {
        const { client, builder } = createMockClient({ data: [], error: null });

        await fetchDiveListPage(client, { filter: { location: '伊豆' } });

        expect(builder.not).not.toHaveBeenCalled();
    });

    it('ダイブタイプを eq で反映する（FR-003）', async () => {
        const { client, builder } = createMockClient({ data: [], error: null });

        await fetchDiveListPage(client, { filter: { diveType: 'boat' } });

        expect(builder.eq).toHaveBeenCalledWith('dive_type', 'boat');
    });

    it('cursor 指定時は (dive_date, id) の複合カーソル条件を付与する', async () => {
        const { client, builder } = createMockClient({ data: [], error: null });
        const id = '0b8f4e2a-1111-4222-8333-444444444444';

        await fetchDiveListPage(client, { cursor: { diveDate: '2026-06-01', id } });

        expect(builder.or).toHaveBeenCalledWith(`dive_date.lt.2026-06-01,and(dive_date.eq.2026-06-01,id.lt.${id})`);
    });

    it('形式が不正な cursor（PostgREST フィルタ構文の注入）はクエリせず空ページを返す', async () => {
        const { client, builder } = createMockClient({ data: [], error: null });

        const page = await fetchDiveListPage(client, { cursor: { diveDate: '2026-06-01', id: 'x),user_id.neq.0' } });

        expect(page).toEqual({ items: [], nextCursor: null });
        expect(builder.or).not.toHaveBeenCalled();
    });

    it('limit を超える行が返ったら limit 件に切り詰めて nextCursor を返す', async () => {
        const rows = [
            buildRow({ id: 'd3', dive_date: '2026-06-03' }),
            buildRow({ id: 'd2', dive_date: '2026-06-02' }),
            buildRow({ id: 'd1', dive_date: '2026-06-01' }),
        ];
        const { client } = createMockClient({ data: rows, error: null });

        const page = await fetchDiveListPage(client, { limit: 2 });

        expect(page.items.map((item) => item.id)).toEqual(['d3', 'd2']);
        expect(page.nextCursor).toEqual({ diveDate: '2026-06-02', id: 'd2' });
    });

    it('行数が limit 以下なら nextCursor は null', async () => {
        const { client } = createMockClient({ data: [buildRow()], error: null });

        const page = await fetchDiveListPage(client, { limit: 2 });

        expect(page.items).toHaveLength(1);
        expect(page.nextCursor).toBeNull();
    });

    it('Supabase エラー時は throw する', async () => {
        const { client } = createMockClient({ data: null, error: { message: 'permission denied' } });

        await expect(fetchDiveListPage(client)).rejects.toThrow(/permission denied/);
    });
});

describe('applyDiveListFilter - バディ絞り込み（spec 021 FR-022/023）', () => {
    /** dive_log_buddies の取得結果を返す thenable チェーンと、主クエリ（in スパイ付き）を用意する */
    const setup = (buddyRows: { dive_id: string }[]) => {
        const buddyBuilder = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            ilike: vi.fn().mockReturnThis(),
            // biome-ignore lint/suspicious/noThenProperty: Supabase クエリビルダーは thenable のためモックでも then を実装する
            then: (resolve: (value: { data: { dive_id: string }[]; error: null }) => void) =>
                resolve({ data: buddyRows, error: null }),
        };
        const supabase = { from: vi.fn(() => buddyBuilder) } as unknown as Parameters<typeof applyDiveListFilter>[0];
        const next = {
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            not: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
        };
        return { supabase, next, buddyBuilder };
    };

    it('buddyUserId は dive_log_buddies から dive_id を引き id を in で絞り込む', async () => {
        const { supabase, next, buddyBuilder } = setup([{ dive_id: 'd1' }, { dive_id: 'd2' }]);
        await applyDiveListFilter(supabase, next as never, { buddyUserId: 'u1' });
        expect(buddyBuilder.eq).toHaveBeenCalledWith('buddy_user_id', 'u1');
        expect(buddyBuilder.eq).toHaveBeenCalledWith('removed_by_buddy', false);
        expect(next.in).toHaveBeenCalledWith('id', ['d1', 'd2']);
    });

    it('buddyName は removed_by_buddy=false の部分一致で dive_id を引いて絞り込む', async () => {
        const { supabase, next, buddyBuilder } = setup([{ dive_id: 'd3' }]);
        await applyDiveListFilter(supabase, next as never, { buddyName: '海太郎' });
        expect(buddyBuilder.eq).toHaveBeenCalledWith('removed_by_buddy', false);
        expect(buddyBuilder.ilike).toHaveBeenCalledWith('buddy_name', '%海太郎%');
        expect(next.in).toHaveBeenCalledWith('id', ['d3']);
    });

    it('該当バディが無ければ空集合で in を呼び 0 件に絞る', async () => {
        const { supabase, next } = setup([]);
        await applyDiveListFilter(supabase, next as never, { buddyUserId: 'u1' });
        expect(next.in).toHaveBeenCalledWith('id', []);
    });
});
