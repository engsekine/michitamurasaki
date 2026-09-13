import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClient = vi.fn();
const revalidatePath = vi.fn();

vi.mock('@/shared/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => createClient(...args),
}));
vi.mock('next/cache', () => ({
    revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

import { markAllNotificationsRead, markNotificationRead, setNotificationPreference } from './actions';

interface MockOptions {
    user?: { id: string } | null;
    updatedRows?: { id: string }[];
    updateError?: { message: string } | null;
}

const buildSupabase = (options: MockOptions = {}) => {
    const { user = { id: 'user-1' }, updatedRows = [{ id: 'notif-1' }], updateError = null } = options;

    // update().eq().eq().is().select() のチェーン（select で解決）
    const chain: Record<string, unknown> = {};
    for (const method of ['update', 'eq', 'is']) {
        chain[method] = vi.fn(() => chain);
    }
    chain['select'] = vi.fn(async () => ({ data: updateError ? null : updatedRows, error: updateError }));
    // notification_preferences の upsert
    chain['upsert'] = vi.fn(async () => ({ error: updateError }));

    const from = vi.fn(() => chain);
    const getUser = vi.fn().mockResolvedValue({ data: { user } });

    return { client: { auth: { getUser }, from }, chain };
};

beforeEach(() => {
    createClient.mockReset();
    revalidatePath.mockReset();
});

describe('markNotificationRead', () => {
    it('本人条件付きで read_at を更新し成功を返す', async () => {
        const mock = buildSupabase();
        createClient.mockResolvedValue(mock.client);

        const result = await markNotificationRead('notif-1');

        expect(result.success).toBe(true);
        expect(mock.chain['eq']).toHaveBeenCalledWith('id', 'notif-1');
        expect(mock.chain['eq']).toHaveBeenCalledWith('recipient_id', 'user-1');
        expect(revalidatePath).toHaveBeenCalledWith('/notifications');
    });

    it('0 行更新（他人の id・既に既読）でも成功扱い（冪等・情報を漏らさない）', async () => {
        const mock = buildSupabase({ updatedRows: [] });
        createClient.mockResolvedValue(mock.client);

        const result = await markNotificationRead('someone-elses-id');

        expect(result.success).toBe(true);
    });

    it('更新エラーは失敗を返す', async () => {
        const mock = buildSupabase({ updateError: { message: 'boom' } });
        createClient.mockResolvedValue(mock.client);

        const result = await markNotificationRead('notif-1');

        expect(result.success).toBe(false);
    });

    it('未ログインは失敗を返す', async () => {
        const mock = buildSupabase({ user: null });
        createClient.mockResolvedValue(mock.client);

        const result = await markNotificationRead('notif-1');

        expect(result).toEqual({ success: false, error: 'ログインが必要です' });
    });
});

describe('setNotificationPreference', () => {
    it('user_id × type で upsert して成功を返す', async () => {
        const mock = buildSupabase();
        createClient.mockResolvedValue(mock.client);

        const result = await setNotificationPreference('followed', false);

        expect(result.success).toBe(true);
        expect(mock.chain['upsert']).toHaveBeenCalledWith(
            { user_id: 'user-1', type: 'followed', is_enabled: false },
            { onConflict: 'user_id,type' },
        );
        expect(revalidatePath).toHaveBeenCalledWith('/settings/notifications');
    });

    it('不正な種別はサーバー側で拒否する', async () => {
        const mock = buildSupabase();
        createClient.mockResolvedValue(mock.client);

        // 型を偽装した直接呼び出し（Server Action は任意クライアントから呼べる）
        const result = await setNotificationPreference('evil_type' as never, false);

        expect(result).toEqual({ success: false, error: '不正な通知種別です' });
        expect(mock.chain['upsert']).not.toHaveBeenCalled();
    });

    it('保存失敗は失敗を返す', async () => {
        const mock = buildSupabase({ updateError: { message: 'boom' } });
        createClient.mockResolvedValue(mock.client);

        const result = await setNotificationPreference('plan_reminder', true);

        expect(result.success).toBe(false);
    });
});

describe('markAllNotificationsRead', () => {
    it('本人の未読すべてを既読化して成功を返す', async () => {
        const mock = buildSupabase({ updatedRows: [{ id: 'n1' }, { id: 'n2' }] });
        createClient.mockResolvedValue(mock.client);

        const result = await markAllNotificationsRead();

        expect(result.success).toBe(true);
        expect(mock.chain['eq']).toHaveBeenCalledWith('recipient_id', 'user-1');
        expect(mock.chain['is']).toHaveBeenCalledWith('read_at', null);
        expect(revalidatePath).toHaveBeenCalledWith('/notifications');
    });

    it('更新エラーは失敗を返す', async () => {
        const mock = buildSupabase({ updateError: { message: 'boom' } });
        createClient.mockResolvedValue(mock.client);

        const result = await markAllNotificationsRead();

        expect(result.success).toBe(false);
    });
});
