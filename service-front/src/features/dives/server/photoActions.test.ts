import { beforeEach, describe, expect, it, vi } from 'vitest';

const revalidatePath = vi.fn();
const createClient = vi.fn();
const processPhoto = vi.fn();

vi.mock('next/cache', () => ({
    revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));
vi.mock('@/shared/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => createClient(...args),
}));
vi.mock('@/features/dives/lib/imageProcessing', () => ({
    processPhoto: (...args: unknown[]) => processPhoto(...args),
}));

import { addDivePhoto, deleteDivePhoto } from './photoActions';

/** select/eq/order/limit を連結でき、await でも maybeSingle/single でも同じ結果を返す簡易チェーン */
const chain = (result: unknown) => {
    const c: any = {};
    for (const m of ['select', 'eq', 'order', 'limit', 'insert', 'delete', 'update']) {
        c[m] = vi.fn(() => c);
    }
    c.maybeSingle = vi.fn(async () => result);
    c.single = vi.fn(async () => result);
    // count クエリ（.eq を await）用に thenable にする。テスト専用の意図的な then
    // biome-ignore lint/suspicious/noThenProperty: テスト用の thenable チェーン
    c.then = (resolve: any) => resolve(result);
    return c;
};

const storageMock = (over: Record<string, unknown> = {}) => {
    const download = vi.fn(async () => ({
        data: { arrayBuffer: async () => new ArrayBuffer(8) },
        error: null,
    }));
    const upload = vi.fn(async () => ({ error: null }));
    const remove = vi.fn(async () => ({ error: null }));
    return {
        from: vi.fn(() => ({ download, upload, remove, ...over })),
        _download: download,
        _upload: upload,
        _remove: remove,
    };
};

const authUser = (user: { id: string } | null) => ({ getUser: async () => ({ data: { user } }) });

describe('addDivePhoto', () => {
    beforeEach(() => {
        revalidatePath.mockReset();
        createClient.mockReset();
        processPhoto.mockReset();
        processPhoto.mockResolvedValue({ display: Buffer.from('d'), thumb: Buffer.from('t'), width: 800, height: 600 });
    });

    it('未認証は失敗', async () => {
        createClient.mockResolvedValue({ auth: authUser(null) });
        const result = await addDivePhoto({ diveId: 'd1', origPath: 'u1/d1/orig/x.jpg' });
        expect(result).toEqual({ success: false, error: 'ログインが必要です' });
    });

    it('他人の dive は失敗', async () => {
        const dives = chain({ data: null, error: null });
        createClient.mockResolvedValue({
            auth: authUser({ id: 'u1' }),
            from: vi.fn(() => dives),
            storage: storageMock(),
        });
        const result = await addDivePhoto({ diveId: 'd1', origPath: 'u1/d1/orig/x.jpg' });
        expect(result).toEqual({ success: false, error: '対象のログが見つかりません' });
    });

    it('枚数上限超過は失敗', async () => {
        let call = 0;
        const from = vi.fn((table: string) => {
            if (table === 'dives') return chain({ data: { id: 'd1' }, error: null });
            call += 1;
            return chain({ count: 10, error: null });
        });
        createClient.mockResolvedValue({ auth: authUser({ id: 'u1' }), from, storage: storageMock() });
        const result = await addDivePhoto({ diveId: 'd1', origPath: 'u1/d1/orig/x.jpg' });
        expect(result).toEqual({ success: false, error: '写真は 1 ログにつき最大 10 枚までです' });
        expect(call).toBe(1);
    });

    it('正常時は処理・保存・登録し、初回は代表写真になる', async () => {
        const insert = chain({ data: { id: 'photo-1' }, error: null });
        let dpCall = 0;
        const from = vi.fn((table: string) => {
            if (table === 'dives') return chain({ data: { id: 'd1' }, error: null });
            dpCall += 1;
            return dpCall === 1 ? chain({ count: 0, error: null }) : insert;
        });
        const storage = storageMock();
        createClient.mockResolvedValue({ auth: authUser({ id: 'u1' }), from, storage });

        const result = await addDivePhoto({ diveId: 'd1', origPath: 'u1/d1/orig/x.jpg', caption: ' 海 ' });

        expect(result).toEqual({ success: true, photoId: 'photo-1' });
        expect(processPhoto).toHaveBeenCalledOnce();
        // is_cover=true / sort_order=0 / caption trim
        const insertedRow = insert.insert.mock.calls[0][0];
        expect(insertedRow).toMatchObject({
            dive_id: 'd1',
            user_id: 'u1',
            is_cover: true,
            sort_order: 0,
            caption: '海',
        });
        expect(revalidatePath).toHaveBeenCalledWith('/dives/d1');
    });

    it('キャプションが上限を超える場合は原本を取得せずに失敗する（サーバー側再検証）', async () => {
        const from = vi.fn(() => chain({ data: { id: 'd1' }, error: null }));
        const storage = storageMock();
        createClient.mockResolvedValue({ auth: authUser({ id: 'u1' }), from, storage });

        const result = await addDivePhoto({ diveId: 'd1', origPath: 'u1/d1/orig/x.jpg', caption: 'あ'.repeat(201) });

        expect(result).toEqual({ success: false, error: 'キャプションは 200 文字以内で入力してください' });
        expect(storage._download).not.toHaveBeenCalled();
    });

    it('型不一致の payload（diveId が数値）は TypeError にならず失敗を返す', async () => {
        createClient.mockResolvedValue({ auth: authUser({ id: 'u1' }), from: vi.fn(), storage: storageMock() });

        const result = await addDivePhoto({ diveId: 1 as unknown as string, origPath: 'u1/d1/orig/x.jpg' });

        expect(result).toEqual({ success: false, error: '不正なリクエストです' });
    });

    it('本人 / dive 配下でない origPath は失敗', async () => {
        const from = vi.fn(() => chain({ data: { id: 'd1' }, error: null }));
        createClient.mockResolvedValue({ auth: authUser({ id: 'u1' }), from, storage: storageMock() });
        const result = await addDivePhoto({ diveId: 'd1', origPath: 'attacker/d1/orig/x.jpg' });
        expect(result).toEqual({ success: false, error: '不正な画像パスです' });
    });

    it('画像処理に失敗したら形式エラーを返し原本を削除する', async () => {
        processPhoto.mockRejectedValueOnce(new Error('bad image'));
        let dpCall = 0;
        const from = vi.fn((table: string) => {
            if (table === 'dives') return chain({ data: { id: 'd1' }, error: null });
            dpCall += 1;
            return chain({ count: 0, error: null });
        });
        const storage = storageMock();
        createClient.mockResolvedValue({ auth: authUser({ id: 'u1' }), from, storage });

        const result = await addDivePhoto({ diveId: 'd1', origPath: 'u1/d1/orig/x.jpg' });
        expect(result).toEqual({ success: false, error: '対応していない画像形式です' });
        expect(dpCall).toBe(1);
    });
});

describe('deleteDivePhoto', () => {
    beforeEach(() => {
        revalidatePath.mockReset();
        createClient.mockReset();
    });

    it('未認証は失敗', async () => {
        createClient.mockResolvedValue({ auth: authUser(null) });
        expect(await deleteDivePhoto('p1')).toEqual({ success: false, error: 'ログインが必要です' });
    });

    it('代表写真を削除したら残りの先頭を代表に昇格する', async () => {
        const fetchChain = chain({
            data: {
                id: 'p1',
                dive_id: 'd1',
                display_path: 'u1/d1/display/p1.webp',
                thumb_path: 'u1/d1/thumb/p1.webp',
                is_cover: true,
            },
            error: null,
        });
        const deleteChain = chain({ error: null });
        const nextChain = chain({ data: { id: 'p2' }, error: null });
        const updateChain = chain({ error: null });
        const queue = [fetchChain, deleteChain, nextChain, updateChain];
        const from = vi.fn(() => queue.shift());
        const storage = storageMock();
        createClient.mockResolvedValue({ auth: authUser({ id: 'u1' }), from, storage });

        const result = await deleteDivePhoto('p1');
        expect(result).toEqual({ success: true });
        expect(updateChain.update).toHaveBeenCalledWith({ is_cover: true });
        expect(storage._remove).toHaveBeenCalledWith(['u1/d1/display/p1.webp', 'u1/d1/thumb/p1.webp']);
        expect(revalidatePath).toHaveBeenCalledWith('/dives/d1');
    });

    it('存在しない / 他人の写真は失敗', async () => {
        const from = vi.fn(() => chain({ data: null, error: null }));
        createClient.mockResolvedValue({ auth: authUser({ id: 'u1' }), from, storage: storageMock() });
        expect(await deleteDivePhoto('p1')).toEqual({ success: false, error: '対象の写真が見つかりません' });
    });
});
