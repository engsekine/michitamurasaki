import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClient = vi.fn();

vi.mock('@/shared/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => createClient(...args),
}));

import { getUnreadNotificationCount, listNotifications } from './queries';

/** テスト用の通知行を組み立てる */
const buildRow = (index: number, overrides: Record<string, unknown> = {}) => ({
    id: `notif-${index}`,
    type: 'followed',
    actor_id: `actor-${index}`,
    resource_id: null,
    occurred_at: `2026-07-02T10:00:${String(59 - index).padStart(2, '0')}Z`,
    read_at: null,
    ...overrides,
});

interface MockOptions {
    user?: { id: string } | null;
    rows?: Record<string, unknown>[];
    rowsError?: { message: string } | null;
    /** get_user_public_profiles の戻り（actor の nickname 解決） */
    profiles?: { user_id: string; nickname: string }[];
    count?: number | null;
    countError?: { message: string } | null;
}

const buildSupabase = (options: MockOptions = {}) => {
    const {
        user = { id: 'user-1' },
        rows = [],
        rowsError = null,
        profiles = [],
        count = 0,
        countError = null,
    } = options;

    // list: select().eq().order().order().limit()（+ or()）を thenable で解決
    const listChain: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'order', 'limit', 'or', 'lt']) {
        listChain[method] = vi.fn(() => listChain);
    }
    listChain['then'] = (resolve: (v: unknown) => unknown) => resolve({ data: rows, error: rowsError });

    // count: select(head:true).eq().is() を thenable で解決
    const countChain: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'is']) {
        countChain[method] = vi.fn(() => countChain);
    }
    countChain['then'] = (resolve: (v: unknown) => unknown) => resolve({ count, error: countError });

    let notificationsCallCount = 0;
    const from = vi.fn((table: string) => {
        if (table === 'notifications') {
            notificationsCallCount += 1;
            // listNotifications は 1 回目、getUnreadNotificationCount 用は head:true の select を使う
            return listChain['__mode'] === 'count' || countChain['__forced'] ? countChain : listChain;
        }
        throw new Error(`unexpected table: ${table}`);
    });

    const rpc = vi.fn().mockResolvedValue({ data: profiles, error: null });
    const getUser = vi.fn().mockResolvedValue({ data: { user } });

    return {
        client: { auth: { getUser }, from, rpc },
        listChain,
        countChain,
        rpc,
        getNotificationsCallCount: () => notificationsCallCount,
    };
};

/** count 用のモック（from('notifications') が countChain を返す） */
const buildCountSupabase = (options: MockOptions = {}) => {
    const mock = buildSupabase(options);
    mock.countChain['__forced'] = true;
    return mock;
};

beforeEach(() => {
    createClient.mockReset();
});

describe('listNotifications', () => {
    it('20 件 + 1 件のとき 20 件と nextCursor を返す（keyset）', async () => {
        const rows = Array.from({ length: 21 }, (_, i) => buildRow(i));
        const mock = buildSupabase({ rows, profiles: [{ user_id: 'actor-0', nickname: 'たろう' }] });
        createClient.mockResolvedValue(mock.client);

        const page = await listNotifications();

        expect(page.items).toHaveLength(20);
        expect(page.nextCursor).not.toBeNull();
        expect(page.items[0]?.id).toBe('notif-0');
    });

    it('次ページが無いとき nextCursor は null', async () => {
        const mock = buildSupabase({ rows: [buildRow(0)] });
        createClient.mockResolvedValue(mock.client);

        const page = await listNotifications();

        expect(page.items).toHaveLength(1);
        expect(page.nextCursor).toBeNull();
    });

    it('actor の nickname を解決し、退会済み（解決不可）は null になる', async () => {
        const rows = [buildRow(0), buildRow(1, { actor_id: null })];
        const mock = buildSupabase({ rows, profiles: [{ user_id: 'actor-0', nickname: 'たろう' }] });
        createClient.mockResolvedValue(mock.client);

        const page = await listNotifications();

        expect(page.items[0]?.actorNickname).toBe('たろう');
        expect(page.items[1]?.actorNickname).toBeNull();
    });

    it('未ログインは空ページを返す', async () => {
        const mock = buildSupabase({ user: null });
        createClient.mockResolvedValue(mock.client);

        const page = await listNotifications();

        expect(page.items).toHaveLength(0);
        expect(page.nextCursor).toBeNull();
    });
});

describe('getUnreadNotificationCount', () => {
    it('未読件数を返す', async () => {
        const mock = buildCountSupabase({ count: 3 });
        createClient.mockResolvedValue(mock.client);

        await expect(getUnreadNotificationCount()).resolves.toBe(3);
    });

    it('取得失敗時は 0 を返しページ描画を止めない', async () => {
        const mock = buildCountSupabase({ count: null, countError: { message: 'boom' } });
        createClient.mockResolvedValue(mock.client);

        await expect(getUnreadNotificationCount()).resolves.toBe(0);
    });

    it('未ログインは 0 を返す', async () => {
        const mock = buildCountSupabase({ user: null });
        createClient.mockResolvedValue(mock.client);

        await expect(getUnreadNotificationCount()).resolves.toBe(0);
    });
});
