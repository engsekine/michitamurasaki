import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SheetFormValues } from '../types';
import { deleteApplicationSheet, saveApplicationBaseProfile, saveApplicationSheet } from './actions';

const revalidatePath = vi.fn();
const createClient = vi.fn();

vi.mock('next/cache', () => ({
    revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

vi.mock('@/shared/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => createClient(...args),
}));

interface SupabaseMockOptions {
    user?: { id: string } | null;
    sheetCount?: number;
    insertError?: { code?: string; message: string } | null;
    updatedRow?: { id: string } | null;
    updateError?: { code?: string; message: string } | null;
    deleteError?: { code?: string; message: string } | null;
}

const buildSupabaseMock = (options: SupabaseMockOptions = {}) => {
    const {
        user = { id: 'user-1' },
        sheetCount = 0,
        insertError = null,
        updatedRow = { id: 'sheet-1' },
        updateError = null,
        deleteError = null,
    } = options;

    // insert(): シート新規は .select().single() で解決する。
    // 基本情報の insert は builder を直接 await するが、モックは非 thenable のため
    // await は同じオブジェクトを返し、error プロパティが undefined = 成功として扱われる
    const insertResolved = insertError
        ? { data: null, error: insertError }
        : { data: { id: 'sheet-new' }, error: null };
    const insert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue(insertResolved) }),
    });

    // update(): eq を可変長でチェーンし .select().maybeSingle() で解決する
    const updateResolved = updateError ? { data: null, error: updateError } : { data: updatedRow, error: null };
    const updateSelect = vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue(updateResolved) });
    const updateEq = vi.fn();
    updateEq.mockImplementation(() => ({ eq: updateEq, select: updateSelect }));
    const update = vi.fn().mockReturnValue({ eq: updateEq });

    // delete().eq().eq()
    const deleteEqUser = vi.fn().mockResolvedValue({ error: deleteError });
    const deleteEqId = vi.fn().mockReturnValue({ eq: deleteEqUser });
    const deleteFn = vi.fn().mockReturnValue({ eq: deleteEqId });

    // select(count).eq('kind', 'sheet')
    const countEq = vi.fn().mockResolvedValue({ count: sheetCount, error: null });
    const select = vi.fn().mockReturnValue({ eq: countEq });

    const from = vi.fn().mockReturnValue({ insert, update, delete: deleteFn, select });
    const supabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
        from,
    };
    createClient.mockResolvedValue(supabase);
    return { from, insert, update, updateEq, deleteFn, deleteEqId, deleteEqUser };
};

const validValues: SheetFormValues = {
    fullName: '山田 太郎',
    age: '36',
    birthOn: '1990-05-03',
    gender: 'male',
    phone: '090-1234-5678',
    emergencyContactRelation: '妻',
    emergencyContactPhone: '080-9876-5432',
    nearestStation: '横浜駅',
    licenseRank: 'Open Water Diver',
    diveCount: '52',
    lastDiveYearMonth: '2026年5月',
    hasDrySuitExperience: '',
    drySuitDiveCount: '10',
    hasRental: 'yes',
    rentalItems: ['wetSuitFullSet', 'fin'],
    omitRentalBlock: false,
    heightCm: '172.5',
    weightKg: '65',
    footSizeCm: '26.5',
    hasContactLens: 'yes',
    contactLensType: 'soft',
    needsPrescriptionMask: 'no',
    diveShopId: '',
};

const expectedDbRow = {
    name: '〇〇ショップ用',
    full_name: '山田 太郎',
    age: 36,
    birth_on: '1990-05-03',
    gender: 'male',
    phone: '090-1234-5678',
    emergency_contact_relation: '妻',
    emergency_contact_phone: '080-9876-5432',
    nearest_station: '横浜駅',
    license_rank: 'Open Water Diver',
    dive_count: 52,
    last_dive_year_month: '2026-05',
    has_dry_suit_experience: null,
    dry_suit_dive_count: 10,
    has_rental: true,
    rental_items: ['wetSuitFullSet', 'fin'],
    omit_rental_block: false,
    height_cm: 172.5,
    weight_kg: 65,
    foot_size_cm: 26.5,
    has_contact_lens: true,
    contact_lens_type: 'soft',
    needs_prescription_mask: false,
    dive_shop_id: null,
};

describe('saveApplicationSheet', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    it('新規保存: 本人 user_id + シート名でフォーム全体を insert する', async () => {
        const { insert } = buildSupabaseMock();

        const result = await saveApplicationSheet({ sheetId: null, name: '〇〇ショップ用', values: validValues });

        expect(result).toEqual({ success: true, id: 'sheet-new' });
        expect(insert).toHaveBeenCalledWith({ ...expectedDbRow, user_id: 'user-1' });
        expect(revalidatePath).toHaveBeenCalledWith('/application-sheet');
    });

    it('上書き保存: 本人のシート（kind=sheet）に限定して update する', async () => {
        const { update, updateEq, insert } = buildSupabaseMock();

        const result = await saveApplicationSheet({
            sheetId: 'sheet-1',
            name: '〇〇ショップ用',
            values: validValues,
        });

        expect(result).toEqual({ success: true, id: 'sheet-1' });
        expect(update).toHaveBeenCalledWith(expectedDbRow);
        expect(updateEq.mock.calls).toEqual([
            ['id', 'sheet-1'],
            ['user_id', 'user-1'],
            ['kind', 'sheet'],
        ]);
        expect(insert).not.toHaveBeenCalled();
    });

    it('上書き対象が見つからない（他人のシート含む）と失敗を返す', async () => {
        buildSupabaseMock({ updatedRow: null });

        const result = await saveApplicationSheet({
            sheetId: 'someone-elses',
            name: '〇〇ショップ用',
            values: validValues,
        });

        expect(result).toEqual({ success: false, error: '保存先のシートが見つかりません' });
    });

    it('シート名が空だと保存しない', async () => {
        const { insert } = buildSupabaseMock();

        const result = await saveApplicationSheet({ sheetId: null, name: '   ', values: validValues });

        expect(result).toEqual({ success: false, error: 'シート名を入力してください' });
        expect(insert).not.toHaveBeenCalled();
    });

    it('シート名が 50 文字を超えると保存しない', async () => {
        const { insert } = buildSupabaseMock();

        const result = await saveApplicationSheet({ sheetId: null, name: 'あ'.repeat(51), values: validValues });

        expect(result).toEqual({ success: false, error: 'シート名は50文字以内で入力してください' });
        expect(insert).not.toHaveBeenCalled();
    });

    it('保存上限（20 件）に達していると新規保存できない', async () => {
        const { insert } = buildSupabaseMock({ sheetCount: 20 });

        const result = await saveApplicationSheet({ sheetId: null, name: '21 枚目', values: validValues });

        expect(result).toEqual({
            success: false,
            error: '保存できるシートは20件までです。不要なシートを削除してください',
        });
        expect(insert).not.toHaveBeenCalled();
    });

    it('上限件数でも上書き保存はできる', async () => {
        const { update } = buildSupabaseMock({ sheetCount: 20 });

        const result = await saveApplicationSheet({
            sheetId: 'sheet-1',
            name: '〇〇ショップ用',
            values: validValues,
        });

        expect(result).toEqual({ success: true, id: 'sheet-1' });
        expect(update).toHaveBeenCalled();
    });

    it('不正な入力はエラーを返し保存しない', async () => {
        const { insert } = buildSupabaseMock();

        const result = await saveApplicationSheet({
            sheetId: null,
            name: '〇〇ショップ用',
            values: { ...validValues, phone: '090-abcd' },
        });

        expect(result).toEqual({ success: false, error: '携帯電話は数字とハイフンで入力してください' });
        expect(insert).not.toHaveBeenCalled();
    });

    it('未ログインなら失敗を返す', async () => {
        const { insert } = buildSupabaseMock({ user: null });

        const result = await saveApplicationSheet({ sheetId: null, name: '〇〇ショップ用', values: validValues });

        expect(result).toEqual({ success: false, error: 'ログインが必要です' });
        expect(insert).not.toHaveBeenCalled();
    });

    it('DB エラー時は失敗を返し、ログに個人情報の値を含めない', async () => {
        buildSupabaseMock({ insertError: { message: 'db error' } });

        const result = await saveApplicationSheet({ sheetId: null, name: '〇〇ショップ用', values: validValues });

        expect(result).toEqual({ success: false, error: '保存に失敗しました。時間をおいて再度お試しください' });

        const loggedText = vi
            .mocked(console.error)
            .mock.calls.flat()
            .map((arg) => JSON.stringify(arg) ?? String(arg))
            .join(' ');
        expect(loggedText).not.toContain('090-1234-5678');
        expect(loggedText).not.toContain('080-9876-5432');
        expect(loggedText).not.toContain('横浜駅');
    });
});

describe('saveApplicationBaseProfile', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    const expectedBaseRow = {
        full_name: '山田 太郎',
        age: 36,
        birth_on: '1990-05-03',
        gender: 'male',
        phone: '090-1234-5678',
        emergency_contact_relation: '妻',
        emergency_contact_phone: '080-9876-5432',
        nearest_station: '横浜駅',
        license_rank: 'Open Water Diver',
        dive_count: 52,
        last_dive_year_month: '2026-05',
        has_dry_suit_experience: null,
        dry_suit_dive_count: 10,
    };

    it('基本情報 + 経験を kind=base の行へ更新保存する（既存あり）', async () => {
        const { update, updateEq, insert } = buildSupabaseMock({ updatedRow: { id: 'base-1' } });

        const result = await saveApplicationBaseProfile(validValues);

        expect(result).toEqual({ success: true });
        expect(update).toHaveBeenCalledWith(expectedBaseRow);
        expect(updateEq.mock.calls).toEqual([
            ['kind', 'base'],
            ['user_id', 'user-1'],
        ]);
        expect(insert).not.toHaveBeenCalled();
        expect(revalidatePath).toHaveBeenCalledWith('/application-sheet');
    });

    it('kind=base の行が無ければ固定名で新規作成する', async () => {
        const { insert } = buildSupabaseMock({ updatedRow: null });

        const result = await saveApplicationBaseProfile(validValues);

        expect(result).toEqual({ success: true });
        expect(insert).toHaveBeenCalledWith({
            ...expectedBaseRow,
            kind: 'base',
            name: '基本情報',
            user_id: 'user-1',
        });
    });

    it('不正な入力はエラーを返し保存しない', async () => {
        const { update } = buildSupabaseMock();

        const result = await saveApplicationBaseProfile({ ...validValues, phone: '090-abcd' });

        expect(result).toEqual({ success: false, error: '携帯電話は数字とハイフンで入力してください' });
        expect(update).not.toHaveBeenCalled();
    });

    it('未ログインなら失敗を返す', async () => {
        const { update } = buildSupabaseMock({ user: null });

        const result = await saveApplicationBaseProfile(validValues);

        expect(result).toEqual({ success: false, error: 'ログインが必要です' });
        expect(update).not.toHaveBeenCalled();
    });

    it('DB エラー時は失敗を返し、ログに個人情報の値を含めない', async () => {
        buildSupabaseMock({ updateError: { message: 'db error' } });

        const result = await saveApplicationBaseProfile(validValues);

        expect(result).toEqual({
            success: false,
            error: '基本情報の保存に失敗しました。時間をおいて再度お試しください',
        });

        const loggedText = vi
            .mocked(console.error)
            .mock.calls.flat()
            .map((arg) => JSON.stringify(arg) ?? String(arg))
            .join(' ');
        expect(loggedText).not.toContain('090-1234-5678');
        expect(loggedText).not.toContain('横浜駅');
    });
});

describe('deleteApplicationSheet', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    it('本人のシートに限定して削除する', async () => {
        const { deleteFn, deleteEqId, deleteEqUser } = buildSupabaseMock();

        const result = await deleteApplicationSheet('sheet-1');

        expect(result).toEqual({ success: true });
        expect(deleteFn).toHaveBeenCalled();
        expect(deleteEqId).toHaveBeenCalledWith('id', 'sheet-1');
        expect(deleteEqUser).toHaveBeenCalledWith('user_id', 'user-1');
        expect(revalidatePath).toHaveBeenCalledWith('/application-sheet');
    });

    it('未ログインなら失敗を返す', async () => {
        const { deleteFn } = buildSupabaseMock({ user: null });

        const result = await deleteApplicationSheet('sheet-1');

        expect(result).toEqual({ success: false, error: 'ログインが必要です' });
        expect(deleteFn).not.toHaveBeenCalled();
    });

    it('DB エラー時は失敗を返す', async () => {
        buildSupabaseMock({ deleteError: { message: 'db error' } });

        const result = await deleteApplicationSheet('sheet-1');

        expect(result).toEqual({ success: false, error: '削除に失敗しました。時間をおいて再度お試しください' });
    });
});
