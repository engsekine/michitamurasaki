import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClient = vi.fn();

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/shared/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => createClient(...args),
}));

import { getProfile, type UpdateProfileInput, updateProfile } from './actions';

const updateInput: UpdateProfileInput = {
    lastName: '山田',
    firstName: '太郎',
    lastNameRomaji: 'Yamada',
    firstNameRomaji: 'Taro',
    nickname: 'たろちゃん',
    handle: 'taro-diver',
    birthOn: '1990-01-01',
    gender: 'male',
    heightCm: null,
    weightKg: null,
    diverType: 'general',
    diverNumber: null,
    emailOptIn: false,
};

/** getProfile が返す user_details Row（diver / emailOptIn 検証に必要な列を含む） */
const profileRow = {
    last_name: '山田',
    first_name: '太郎',
    last_name_romaji: 'Yamada',
    first_name_romaji: 'Taro',
    nickname: 'たろちゃん',
    handle: 'taro-diver',
    birth_on: '1990-01-01',
    gender: 'male',
    height_cm: null,
    weight_kg: null,
    diver_type: 'general',
    diver_number: null,
    is_email_opted_in: true,
};

interface MockOptions {
    user?: { id: string; email?: string } | null;
    /** is_nickname_taken RPC の戻り */
    nicknameTaken?: boolean;
    /** update().eq() の戻り error */
    updateError?: { code?: string; message: string } | null;
    /** updateProfile が読む現在の配信許可状態 */
    current?: { is_email_opted_in: boolean; email_opted_in_at: string | null };
    /** getProfile が返す Row（null はエラー扱い） */
    selectRow?: typeof profileRow | null;
}

/**
 * updateProfile は rpc('is_nickname_taken') → select(現在の opt-in).single() → update().eq() を、
 * getProfile は select(...).single() を呼ぶ。両経路を1つのモックでカバーする。
 */
const buildSupabaseMock = (options: MockOptions = {}) => {
    const {
        user = { id: 'user-1', email: 'user@example.com' },
        nicknameTaken = false,
        updateError = null,
        current,
        selectRow,
    } = options;

    const updateEq = vi.fn().mockResolvedValue({ error: updateError });
    const update = vi.fn().mockReturnValue({ eq: updateEq });
    const single = vi.fn().mockResolvedValue({
        // updateProfile の現在値読み取り or getProfile の Row 取得（テストごとに一方だけ設定する）
        data: current ?? selectRow ?? null,
        error: selectRow === null ? { message: 'not found' } : null,
    });
    const select = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single }) });
    const rpc = vi.fn().mockResolvedValue({ data: nicknameTaken, error: null });
    const getUser = vi.fn().mockResolvedValue({ data: { user } });
    const updateUser = vi.fn().mockResolvedValue({ data: {}, error: null });

    const client = {
        auth: { getUser, updateUser },
        from: vi.fn().mockReturnValue({ select, update }),
        rpc,
    };
    createClient.mockResolvedValue(client);
    return { client, update, rpc, updateUser };
};

beforeEach(() => {
    createClient.mockReset();
});

describe('updateProfile', () => {
    it('更新成功時に auth の user_metadata へ handle を同期する（034 Rev.2）', async () => {
        const { updateUser } = buildSupabaseMock();

        const result = await updateProfile(updateInput);

        expect(result).toEqual({ success: true });
        expect(updateUser).toHaveBeenCalledWith({ data: { handle: updateInput.handle } });
    });

    it('metadata 同期が失敗してもプロフィール更新は成功として扱う（034）', async () => {
        const { updateUser } = buildSupabaseMock();
        updateUser.mockResolvedValue({ data: null, error: { message: 'sync failed' } });

        const result = await updateProfile(updateInput);

        expect(result).toEqual({ success: true });
    });

    it('更新成功で success を返す', async () => {
        const { update } = buildSupabaseMock();

        const result = await updateProfile(updateInput);

        expect(update).toHaveBeenCalled();
        expect(result).toEqual({ success: true });
    });

    it('未ログインなら失敗を返す', async () => {
        const { update } = buildSupabaseMock({ user: null });

        const result = await updateProfile(updateInput);

        expect(result).toEqual({ success: false, error: 'ログインが必要です' });
        expect(update).not.toHaveBeenCalled();
    });

    it('nickname が既に使われている場合は UPDATE せず失敗を返す（自分は除外して判定）', async () => {
        const { update, rpc } = buildSupabaseMock({ nicknameTaken: true });

        const result = await updateProfile(updateInput);

        expect(rpc).toHaveBeenCalledWith('is_nickname_taken', {
            p_nickname: 'たろちゃん',
            p_exclude_user_id: 'user-1',
        });
        expect(result.success).toBe(false);
        expect(update).not.toHaveBeenCalled();
    });

    it('nickname 一意制約違反（競合時 23505）はニックネーム重複の失敗を返す', async () => {
        buildSupabaseMock({
            updateError: { code: '23505', message: 'violates unique constraint "user_details_nickname_key"' },
        });

        const result = await updateProfile(updateInput);

        expect(result).toEqual({
            success: false,
            error: 'このニックネームは既に使われています。別のニックネームをお試しください',
        });
    });
});

describe('getProfile - メール配信許可（022）', () => {
    it('is_email_opted_in を emailOptIn として返す', async () => {
        buildSupabaseMock({ selectRow: profileRow });

        const result = await getProfile();

        expect(result?.emailOptIn).toBe(true);
    });
});

describe('updateProfile - メール配信許可（022）', () => {
    it('OFF→ON で email_opted_in_at に日時をセットする', async () => {
        const { update } = buildSupabaseMock({ current: { is_email_opted_in: false, email_opted_in_at: null } });

        await updateProfile({ ...updateInput, emailOptIn: true });

        const payload = update.mock.calls[0]?.[0];
        expect(payload.is_email_opted_in).toBe(true);
        expect(typeof payload.email_opted_in_at).toBe('string');
    });

    it('ON→OFF（撤回）で email_opted_in_at を null にする', async () => {
        const { update } = buildSupabaseMock({
            current: { is_email_opted_in: true, email_opted_in_at: '2026-01-01T00:00:00.000Z' },
        });

        await updateProfile({ ...updateInput, emailOptIn: false });

        const payload = update.mock.calls[0]?.[0];
        expect(payload.is_email_opted_in).toBe(false);
        expect(payload.email_opted_in_at).toBeNull();
    });

    it('ON 維持なら最初の許可日時を保持する', async () => {
        const past = '2026-01-01T00:00:00.000Z';
        const { update } = buildSupabaseMock({ current: { is_email_opted_in: true, email_opted_in_at: past } });

        await updateProfile({ ...updateInput, emailOptIn: true });

        const payload = update.mock.calls[0]?.[0];
        expect(payload.email_opted_in_at).toBe(past);
    });
});
