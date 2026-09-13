import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClient = vi.fn();

vi.mock('@/shared/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => createClient(...args),
}));
/** todayInJst のみ固定し、overhaul.ts が使う daysUntil 等は実装を残す（partial mock） */
vi.mock('@/shared/lib/date', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/shared/lib/date')>()),
    todayInJst: () => '2026-07-02',
}));

import { ensureTimedNotifications } from './queries';

interface MockOptions {
    user?: { id: string } | null;
    /** dive_plans の select 結果 */
    plans?: { id: string; planned_on: string; created_at: string }[];
    /** regulators の select 結果 */
    regulators?: {
        id: string;
        last_overhauled_on: string;
        overhaul_interval_months: number;
        overhaul_interval_dives: number;
    }[];
    /** 既存通知（dedup 済み判定用）の select 結果 */
    existing?: { type: string; resource_id: string | null; dedup_key: string }[];
    /** OFF 設定行 */
    disabledTypes?: string[];
}

const buildSupabase = (options: MockOptions = {}) => {
    const { user = { id: 'user-1' }, plans = [], regulators = [], existing = [], disabledTypes = [] } = options;

    const insert = vi.fn().mockResolvedValue({ error: null });

    // delete().eq().lt() —— 90 日清掃
    const deleteChain: Record<string, unknown> = {};
    for (const method of ['eq', 'lt']) {
        deleteChain[method] = vi.fn(() => deleteChain);
    }
    deleteChain['then'] = (resolve: (v: unknown) => unknown) => resolve({ error: null });

    /** select 系: 呼び出し先テーブルに応じた行を thenable で返す汎用チェーン */
    const buildSelectChain = (rows: unknown[]) => {
        const chain: Record<string, unknown> = {};
        for (const method of ['select', 'eq', 'in', 'lte', 'gte']) {
            chain[method] = vi.fn(() => chain);
        }
        chain['then'] = (resolve: (v: unknown) => unknown) => resolve({ data: rows, error: null });
        return chain;
    };

    const prefRows = disabledTypes.map((type) => ({ type, is_enabled: false }));

    const from = vi.fn((table: string) => {
        if (table === 'dive_plans') return buildSelectChain(plans);
        if (table === 'regulators') return buildSelectChain(regulators);
        if (table === 'notification_preferences') return buildSelectChain(prefRows);
        if (table === 'notifications') {
            const chain = buildSelectChain(existing) as Record<string, unknown>;
            chain['insert'] = insert;
            chain['delete'] = vi.fn(() => deleteChain);
            return chain;
        }
        throw new Error(`unexpected table: ${table}`);
    });

    const getUser = vi.fn().mockResolvedValue({ data: { user } });

    return { client: { auth: { getUser }, from }, insert, deleteChain };
};

beforeEach(() => {
    createClient.mockReset();
});

describe('ensureTimedNotifications', () => {
    it('予定日 = 今日の予定に plan_reminder を挿入する（FR-009）', async () => {
        const mock = buildSupabase({
            plans: [{ id: 'plan-1', planned_on: '2026-07-02', created_at: '2026-07-01T10:00:00Z' }],
        });
        createClient.mockResolvedValue(mock.client);

        await ensureTimedNotifications();

        expect(mock.insert).toHaveBeenCalledWith([
            expect.objectContaining({
                recipient_id: 'user-1',
                type: 'plan_reminder',
                resource_id: 'plan-1',
                dedup_key: '2026-07-02',
            }),
        ]);
    });

    it('過去日で登録された予定（登録日 > 予定日）は生成しない（FR-009）', async () => {
        const mock = buildSupabase({
            plans: [{ id: 'plan-1', planned_on: '2026-07-02', created_at: '2026-07-03T10:00:00Z' }],
        });
        createClient.mockResolvedValue(mock.client);

        await ensureTimedNotifications();

        expect(mock.insert).not.toHaveBeenCalled();
    });

    it('OH 期限到来の機材に overhaul_reminder を挿入する（FR-010）', async () => {
        const mock = buildSupabase({
            regulators: [
                {
                    id: 'reg-1',
                    last_overhauled_on: '2025-06-01',
                    overhaul_interval_months: 12,
                    overhaul_interval_dives: 100,
                },
            ],
        });
        createClient.mockResolvedValue(mock.client);

        await ensureTimedNotifications();

        expect(mock.insert).toHaveBeenCalledWith([
            expect.objectContaining({
                type: 'overhaul_reminder',
                resource_id: 'reg-1',
                dedup_key: '2026-06-01',
            }),
        ]);
    });

    it('既に同じ dedup_key の通知があれば挿入しない（1 回だけ）', async () => {
        const mock = buildSupabase({
            plans: [{ id: 'plan-1', planned_on: '2026-07-02', created_at: '2026-07-01T10:00:00Z' }],
            existing: [{ type: 'plan_reminder', resource_id: 'plan-1', dedup_key: '2026-07-02' }],
        });
        createClient.mockResolvedValue(mock.client);

        await ensureTimedNotifications();

        expect(mock.insert).not.toHaveBeenCalled();
    });

    it('設定 OFF の種別は生成しない（FR-011）', async () => {
        const mock = buildSupabase({
            plans: [{ id: 'plan-1', planned_on: '2026-07-02', created_at: '2026-07-01T10:00:00Z' }],
            disabledTypes: ['plan_reminder'],
        });
        createClient.mockResolvedValue(mock.client);

        await ensureTimedNotifications();

        expect(mock.insert).not.toHaveBeenCalled();
    });

    it('90 日超の通知を削除する（FR-013）', async () => {
        const mock = buildSupabase();
        createClient.mockResolvedValue(mock.client);

        await ensureTimedNotifications();

        expect(mock.deleteChain['eq']).toHaveBeenCalledWith('recipient_id', 'user-1');
        expect(mock.deleteChain['lt']).toHaveBeenCalledWith('occurred_at', expect.any(String));
    });

    it('未ログインは何もしない', async () => {
        const mock = buildSupabase({ user: null });
        createClient.mockResolvedValue(mock.client);

        await ensureTimedNotifications();

        expect(mock.insert).not.toHaveBeenCalled();
    });
});
