import { beforeEach, describe, expect, it, vi } from 'vitest';

const revalidatePath = vi.fn();
const createClient = vi.fn();
const geocode = vi.fn();

vi.mock('next/cache', () => ({
    revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

vi.mock('@/shared/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => createClient(...args),
}));

vi.mock('@/features/shops/lib/geocode', () => ({
    geocode: (...args: unknown[]) => geocode(...args),
}));

import { createShop, deleteShop, geocodeAddress, updateShop } from './actions';

/** 全項目が妥当な入力 */
const validInput = {
    name: 'マリンステージ',
    address: '静岡県伊東市富戸 837-2',
    phone: '0557-51-3535',
    websiteUrl: 'https://example.com',
    memo: '送迎あり',
};

interface SupabaseMockOptions {
    /** undefined ならログイン済み（user-1）、null なら未ログイン */
    user?: { id: string } | null;
    insertError?: { message: string } | null;
    updateError?: { message: string } | null;
    deleteError?: { message: string } | null;
    /** updateShop が参照する現在行。null は「見つからない（他人の id 含む）」 */
    currentRow?: { address: string; latitude: number | null; longitude: number | null } | null;
}

/** Server Action が呼ぶ範囲だけを再現した Supabase クライアントのモック */
const buildSupabaseMock = (options: SupabaseMockOptions = {}) => {
    const {
        user = { id: 'user-1' },
        insertError = null,
        updateError = null,
        deleteError = null,
        currentRow = { address: validInput.address, latitude: 34.9, longitude: 139.1 },
    } = options;

    const insert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
            single: vi
                .fn()
                .mockResolvedValue(
                    insertError ? { data: null, error: insertError } : { data: { id: 'shop-1' }, error: null },
                ),
        }),
    });

    const updateEq = vi.fn().mockResolvedValue({ error: updateError });
    const update = vi.fn().mockReturnValue({ eq: updateEq });

    const deleteEq = vi.fn().mockResolvedValue({ error: deleteError });
    const deleteFn = vi.fn().mockReturnValue({ eq: deleteEq });

    const maybeSingle = vi.fn().mockResolvedValue({ data: currentRow, error: null });
    const select = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) });

    const from = vi.fn(() => ({ insert, update, delete: deleteFn, select }));

    return {
        client: {
            auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
            from,
        },
        insert,
        update,
        updateEq,
        deleteFn,
    };
};

beforeEach(() => {
    vi.clearAllMocks();
    geocode.mockResolvedValue({ lat: 34.9066, lng: 139.1325 });
});

describe('createShop', () => {
    it('未ログインなら失敗を返す', async () => {
        const mock = buildSupabaseMock({ user: null });
        createClient.mockResolvedValue(mock.client);

        const result = await createShop(validInput);

        expect(result).toEqual({ success: false, error: 'ログインが必要です' });
        expect(mock.insert).not.toHaveBeenCalled();
    });

    it('バリデーションエラー（名前空）は失敗を返し INSERT しない', async () => {
        const mock = buildSupabaseMock();
        createClient.mockResolvedValue(mock.client);

        const result = await createShop({ ...validInput, name: '' });

        expect(result.success).toBe(false);
        expect(mock.insert).not.toHaveBeenCalled();
    });

    it('住所ありはジオコーディングして座標込みで INSERT し id を返す', async () => {
        const mock = buildSupabaseMock();
        createClient.mockResolvedValue(mock.client);

        const result = await createShop(validInput);

        expect(geocode).toHaveBeenCalledWith(validInput.address);
        expect(mock.insert).toHaveBeenCalledWith({
            user_id: 'user-1',
            name: validInput.name,
            address: validInput.address,
            phone: validInput.phone,
            website_url: validInput.websiteUrl,
            memo: validInput.memo,
            latitude: 34.9066,
            longitude: 139.1325,
        });
        expect(result).toEqual({ success: true, id: 'shop-1' });
        expect(revalidatePath).toHaveBeenCalledWith('/shops');
    });

    it('ジオコーディング失敗（null）でも座標 null で INSERT は成功する', async () => {
        geocode.mockResolvedValue(null);
        const mock = buildSupabaseMock();
        createClient.mockResolvedValue(mock.client);

        const result = await createShop(validInput);

        expect(mock.insert).toHaveBeenCalledWith(expect.objectContaining({ latitude: null, longitude: null }));
        expect(result.success).toBe(true);
    });

    it('住所空はジオコーディングを呼ばない', async () => {
        const mock = buildSupabaseMock();
        createClient.mockResolvedValue(mock.client);

        await createShop({ ...validInput, address: '' });

        expect(geocode).not.toHaveBeenCalled();
        expect(mock.insert).toHaveBeenCalledWith(expect.objectContaining({ latitude: null, longitude: null }));
    });

    it('INSERT エラーは失敗を返す', async () => {
        const mock = buildSupabaseMock({ insertError: { message: 'insert failed' } });
        createClient.mockResolvedValue(mock.client);

        const result = await createShop(validInput);

        expect(result.success).toBe(false);
    });
});

describe('updateShop', () => {
    it('住所が変わらなければ再ジオコーディングせず既存座標を維持する', async () => {
        const mock = buildSupabaseMock({
            currentRow: { address: validInput.address, latitude: 34.9, longitude: 139.1 },
        });
        createClient.mockResolvedValue(mock.client);

        const result = await updateShop('shop-1', validInput);

        expect(geocode).not.toHaveBeenCalled();
        expect(mock.update).toHaveBeenCalledWith(expect.objectContaining({ latitude: 34.9, longitude: 139.1 }));
        expect(result.success).toBe(true);
    });

    it('住所が変わったら再ジオコーディングする', async () => {
        const mock = buildSupabaseMock({ currentRow: { address: '旧住所', latitude: 30, longitude: 130 } });
        createClient.mockResolvedValue(mock.client);

        await updateShop('shop-1', validInput);

        expect(geocode).toHaveBeenCalledWith(validInput.address);
        expect(mock.update).toHaveBeenCalledWith(expect.objectContaining({ latitude: 34.9066, longitude: 139.1325 }));
    });

    it('住所を空に変更したら座標も null にする', async () => {
        const mock = buildSupabaseMock({ currentRow: { address: '旧住所', latitude: 30, longitude: 130 } });
        createClient.mockResolvedValue(mock.client);

        await updateShop('shop-1', { ...validInput, address: '' });

        expect(geocode).not.toHaveBeenCalled();
        expect(mock.update).toHaveBeenCalledWith(expect.objectContaining({ latitude: null, longitude: null }));
    });

    it('対象行が見つからない（他人の id 含む）場合は失敗を返す', async () => {
        const mock = buildSupabaseMock({ currentRow: null });
        createClient.mockResolvedValue(mock.client);

        const result = await updateShop('shop-x', validInput);

        expect(result.success).toBe(false);
        expect(mock.update).not.toHaveBeenCalled();
    });
});

describe('deleteShop', () => {
    it('削除成功。紐付け解除は DB（on delete set null）に委ねる', async () => {
        const mock = buildSupabaseMock();
        createClient.mockResolvedValue(mock.client);

        const result = await deleteShop('shop-1');

        expect(mock.deleteFn).toHaveBeenCalled();
        expect(result.success).toBe(true);
        expect(revalidatePath).toHaveBeenCalledWith('/shops');
    });

    it('削除エラーは失敗を返す', async () => {
        const mock = buildSupabaseMock({ deleteError: { message: 'delete failed' } });
        createClient.mockResolvedValue(mock.client);

        const result = await deleteShop('shop-1');

        expect(result.success).toBe(false);
    });
});

describe('geocodeAddress', () => {
    it('解決成功で座標を返す', async () => {
        const mock = buildSupabaseMock();
        createClient.mockResolvedValue(mock.client);

        const result = await geocodeAddress('静岡県伊東市富戸');

        expect(result).toEqual({ success: true, latitude: 34.9066, longitude: 139.1325 });
    });

    it('特定不可（null）は null 座標の成功応答を返す（エラーにしない）', async () => {
        geocode.mockResolvedValue(null);
        const mock = buildSupabaseMock();
        createClient.mockResolvedValue(mock.client);

        const result = await geocodeAddress('あいうえお市 9-9-9');

        expect(result).toEqual({ success: true, latitude: null, longitude: null });
    });

    it('未ログインなら失敗を返し API を呼ばない', async () => {
        const mock = buildSupabaseMock({ user: null });
        createClient.mockResolvedValue(mock.client);

        const result = await geocodeAddress('静岡県伊東市富戸');

        expect(result.success).toBe(false);
        expect(geocode).not.toHaveBeenCalled();
    });
});
