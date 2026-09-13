import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/shared/lib/supabase/server', () => ({ createClient: vi.fn() }));

import { revalidatePath } from 'next/cache';

import { createClient } from '@/shared/lib/supabase/server';

import { followUser, likeDive, unfollowUser, unlikeDive } from './actions';

const mockedCreateClient = vi.mocked(createClient);

const VIEWER_ID = '11111111-1111-1111-1111-111111111111';
const TARGET_ID = '22222222-2222-2222-2222-222222222222';

interface ClientOptions {
    /** auth.getUser の戻り。null は未ログイン */
    user?: { id: string } | null;
    /** insert の戻り error（followUser 用） */
    insertError?: { code?: string; message: string } | null;
    /** delete の戻り error（unfollowUser 用） */
    deleteError?: { message: string } | null;
}

const buildClient = ({ user = { id: VIEWER_ID }, insertError = null, deleteError = null }: ClientOptions = {}) => {
    const insert = vi.fn().mockResolvedValue({ error: insertError });

    // delete().eq().eq() のチェーン。最終 await で deleteError を返す thenable
    const deleteBuilder = {
        eq: vi.fn(),
        // biome-ignore lint/suspicious/noThenProperty: Supabase クエリビルダーは thenable のためモックでも then を実装する
        then: (resolve: (value: { error: { message: string } | null }) => void) => resolve({ error: deleteError }),
    };
    deleteBuilder.eq.mockReturnValue(deleteBuilder);
    const deleteFn = vi.fn(() => deleteBuilder);

    const from = vi.fn(() => ({ insert, delete: deleteFn }));
    const getUser = vi.fn().mockResolvedValue({ data: { user } });

    const client = { from, auth: { getUser } };
    mockedCreateClient.mockResolvedValue(client as never);

    return { client, from, insert, deleteFn };
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe('followUser', () => {
    it('フォロー成功時は follower_id=auth.uid を固定して INSERT し success を返す', async () => {
        const { from, insert } = buildClient();

        const result = await followUser(TARGET_ID);

        expect(from).toHaveBeenCalledWith('user_follows');
        expect(insert).toHaveBeenCalledWith({ follower_id: VIEWER_ID, followee_id: TARGET_ID });
        expect(result).toEqual({ success: true, isFollowing: true });
        expect(revalidatePath).toHaveBeenCalledWith('/users/[slug]', 'page');
    });

    it('未ログインなら失敗を返し INSERT しない', async () => {
        const { insert } = buildClient({ user: null });

        const result = await followUser(TARGET_ID);

        expect(result).toEqual({ success: false, error: 'ログインが必要です' });
        expect(insert).not.toHaveBeenCalled();
    });

    it('自分自身はフォローできない', async () => {
        const { insert } = buildClient();

        const result = await followUser(VIEWER_ID);

        expect(result).toEqual({ success: false, error: '自分自身はフォローできません' });
        expect(insert).not.toHaveBeenCalled();
    });

    it('重複フォロー（PK 一意制約違反 23505）は冪等成功として扱う', async () => {
        buildClient({ insertError: { code: '23505', message: 'duplicate key' } });

        const result = await followUser(TARGET_ID);

        expect(result).toEqual({ success: true, isFollowing: true });
    });

    it('その他の DB エラーは失敗を返す', async () => {
        buildClient({ insertError: { code: '42501', message: 'permission denied' } });

        const result = await followUser(TARGET_ID);

        expect(result).toEqual({ success: false, error: 'フォローに失敗しました。時間をおいて再度お試しください' });
    });
});

describe('likeDive', () => {
    const DIVE_ID = 'dddddddd-0000-0000-0000-000000000001';

    it('成功時は user_id=auth.uid を固定して INSERT し、関連パスを revalidate する', async () => {
        const { from, insert } = buildClient();

        const result = await likeDive(DIVE_ID);

        expect(from).toHaveBeenCalledWith('dive_likes');
        expect(insert).toHaveBeenCalledWith({ user_id: VIEWER_ID, dive_id: DIVE_ID });
        expect(result).toEqual({ success: true, isLiked: true });
        expect(revalidatePath).toHaveBeenCalledWith(`/dives/${DIVE_ID}`);
        expect(revalidatePath).toHaveBeenCalledWith('/likes');
        expect(revalidatePath).toHaveBeenCalledWith('/');
    });

    it('未ログインなら失敗を返し INSERT しない', async () => {
        const { insert } = buildClient({ user: null });

        const result = await likeDive(DIVE_ID);

        expect(result).toEqual({ success: false, error: 'ログインが必要です' });
        expect(insert).not.toHaveBeenCalled();
    });

    it('いいね済み（PK 一意制約違反 23505）は冪等成功として扱う', async () => {
        buildClient({ insertError: { code: '23505', message: 'duplicate key' } });

        const result = await likeDive(DIVE_ID);

        expect(result).toEqual({ success: true, isLiked: true });
    });

    it('RLS 違反（42501 = 自分のログ・非公開・削除済み）は専用の失敗文言を返す', async () => {
        buildClient({ insertError: { code: '42501', message: 'new row violates row-level security policy' } });

        const result = await likeDive(DIVE_ID);

        expect(result).toEqual({ success: false, error: 'このログにはいいねできません' });
    });

    it('その他の DB エラーは失敗を返す', async () => {
        buildClient({ insertError: { code: '08000', message: 'connection error' } });

        const result = await likeDive(DIVE_ID);

        expect(result).toEqual({ success: false, error: 'いいねに失敗しました。時間をおいて再度お試しください' });
    });
});

describe('unlikeDive', () => {
    const DIVE_ID = 'dddddddd-0000-0000-0000-000000000001';

    it('成功時は本人の行を DELETE し、関連パスを revalidate する', async () => {
        const { from, deleteFn } = buildClient();

        const result = await unlikeDive(DIVE_ID);

        expect(from).toHaveBeenCalledWith('dive_likes');
        expect(deleteFn).toHaveBeenCalled();
        expect(result).toEqual({ success: true, isLiked: false });
        expect(revalidatePath).toHaveBeenCalledWith(`/dives/${DIVE_ID}`);
        expect(revalidatePath).toHaveBeenCalledWith('/likes');
        expect(revalidatePath).toHaveBeenCalledWith('/');
    });

    it('未ログインなら失敗を返し DELETE しない', async () => {
        const { deleteFn } = buildClient({ user: null });

        const result = await unlikeDive(DIVE_ID);

        expect(result).toEqual({ success: false, error: 'ログインが必要です' });
        expect(deleteFn).not.toHaveBeenCalled();
    });

    it('対象行が無くても冪等に成功を返す（連打・多端末競合）', async () => {
        buildClient({ deleteError: null });

        const result = await unlikeDive(DIVE_ID);

        expect(result).toEqual({ success: true, isLiked: false });
    });

    it('DELETE エラー時は失敗を返す', async () => {
        buildClient({ deleteError: { message: 'permission denied' } });

        const result = await unlikeDive(DIVE_ID);

        expect(result).toEqual({
            success: false,
            error: 'いいねの取り消しに失敗しました。時間をおいて再度お試しください',
        });
    });
});

describe('unfollowUser', () => {
    it('解除成功時は follower/followee で絞り DELETE し success を返す', async () => {
        const { from, deleteFn } = buildClient();

        const result = await unfollowUser(TARGET_ID);

        expect(from).toHaveBeenCalledWith('user_follows');
        expect(deleteFn).toHaveBeenCalled();
        expect(result).toEqual({ success: true, isFollowing: false });
        expect(revalidatePath).toHaveBeenCalledWith('/users/[slug]', 'page');
    });

    it('未ログインなら失敗を返し DELETE しない', async () => {
        const { deleteFn } = buildClient({ user: null });

        const result = await unfollowUser(TARGET_ID);

        expect(result).toEqual({ success: false, error: 'ログインが必要です' });
        expect(deleteFn).not.toHaveBeenCalled();
    });

    it('未フォロー（該当行なし）でも冪等に成功を返す', async () => {
        buildClient({ deleteError: null });

        const result = await unfollowUser(TARGET_ID);

        expect(result).toEqual({ success: true, isFollowing: false });
    });

    it('DELETE エラー時は失敗を返す', async () => {
        buildClient({ deleteError: { message: 'permission denied' } });

        const result = await unfollowUser(TARGET_ID);

        expect(result).toEqual({ success: false, error: 'フォロー解除に失敗しました。時間をおいて再度お試しください' });
    });
});
