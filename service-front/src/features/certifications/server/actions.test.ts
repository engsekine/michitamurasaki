import { beforeEach, describe, expect, it, vi } from 'vitest';

const revalidatePath = vi.fn();
const createClient = vi.fn();

vi.mock('next/cache', () => ({
    revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

vi.mock('@/shared/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => createClient(...args),
}));

import { createCertification, deleteCertification, updateCertification } from './actions';

interface SupabaseMockOptions {
    /** undefined ならログイン済み（user-1）、null なら未ログイン */
    user?: { id: string } | null;
    /** user_details.birth_on の値。null は取得失敗を表す */
    birthOn?: string | null;
    insertError?: { code?: string; message: string } | null;
    updateError?: { code?: string; message: string } | null;
    deleteError?: { message: string } | null;
    tagsInsertError?: { message: string } | null;
    tagsDeleteError?: { message: string } | null;
    /** dives テーブルの maybeSingle が返す行。null は「見つからない（他人のログ含む）」 */
    diveRow?: { id: string } | null;
}

/** Server Action が呼ぶ範囲だけを再現した Supabase クライアントのモック */
const buildSupabaseMock = (options: SupabaseMockOptions = {}) => {
    const {
        user = { id: 'user-1' },
        birthOn = '1990-01-01',
        insertError = null,
        updateError = null,
        deleteError = null,
        tagsInsertError = null,
        tagsDeleteError = null,
        diveRow = { id: 'dive-1' },
    } = options;

    const insert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
            single: vi
                .fn()
                .mockResolvedValue(
                    insertError ? { data: null, error: insertError } : { data: { id: 'cert-1' }, error: null },
                ),
        }),
    });

    const updateEq = vi.fn().mockResolvedValue({ error: updateError });
    const update = vi.fn().mockReturnValue({ eq: updateEq });

    const deleteEq = vi.fn().mockResolvedValue({ error: deleteError });
    const deleteFn = vi.fn().mockReturnValue({ eq: deleteEq });

    const tagsInsert = vi.fn().mockResolvedValue({ error: tagsInsertError });
    const tagsDeleteEq = vi.fn().mockResolvedValue({ error: tagsDeleteError });
    const tagsDelete = vi.fn().mockReturnValue({ eq: tagsDeleteEq });

    const userDetailsSingle = vi
        .fn()
        .mockResolvedValue(
            birthOn === null
                ? { data: null, error: { message: 'fetch failed' } }
                : { data: { birth_on: birthOn }, error: null },
        );

    const divesMaybeSingle = vi.fn().mockResolvedValue({ data: diveRow, error: null });

    const from = vi.fn((table: string) => {
        if (table === 'user_details') {
            return {
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({ single: userDetailsSingle }),
                }),
            };
        }
        if (table === 'certification_tags') {
            return { insert: tagsInsert, delete: tagsDelete };
        }
        if (table === 'dives') {
            /** select().eq('id').eq('user_id').maybeSingle() のチェーンを再現（本人所有チェック） */
            return {
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({ maybeSingle: divesMaybeSingle }),
                    }),
                }),
            };
        }
        return { insert, update, delete: deleteFn };
    });

    const supabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
        from,
    };

    createClient.mockResolvedValue(supabase);
    return { insert, update, updateEq, deleteFn, deleteEq, tagsInsert, tagsDelete, tagsDeleteEq };
};

const validInput = {
    agency: 'padi' as const,
    rank: 'Open Water Diver',
    acquiredOn: '2023-04-01',
    diverNumber: '',
    instructorNumber: '',
    trainedBy: '',
    acquiredLocation: '',
    specialtyTags: '',
    diveId: '',
};

describe('createCertification', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    it('正常系: user_id を auth から強制セットして insert し、一覧を revalidate する', async () => {
        const { insert, tagsInsert } = buildSupabaseMock();

        const result = await createCertification(validInput);

        expect(result).toEqual({ success: true, id: 'cert-1' });
        expect(insert).toHaveBeenCalledWith({
            agency: 'padi',
            rank: 'Open Water Diver',
            acquired_on: '2023-04-01',
            diver_number: null,
            instructor_number: null,
            trained_by: null,
            acquired_location: null,
            dive_id: null,
            user_id: 'user-1',
        });
        expect(tagsInsert).not.toHaveBeenCalled();
        expect(revalidatePath).toHaveBeenCalledWith('/settings/certifications');
    });

    it('取得ダイブを指定すると dive_id 付きで insert される', async () => {
        const { insert } = buildSupabaseMock({ diveRow: { id: 'dive-1' } });

        const result = await createCertification({ ...validInput, diveId: 'dive-1' });

        expect(result).toEqual({ success: true, id: 'cert-1' });
        expect(insert).toHaveBeenCalledWith(expect.objectContaining({ dive_id: 'dive-1' }));
    });

    it('取得ダイブが自分のログとして見つからない場合は拒否する', async () => {
        const { insert } = buildSupabaseMock({ diveRow: null });

        const result = await createCertification({ ...validInput, diveId: 'someone-elses-dive' });

        expect(result).toEqual({
            success: false,
            error: '選択したダイブログが見つかりません。再度選択してください',
        });
        expect(insert).not.toHaveBeenCalled();
    });

    it('任意項目とスペシャリティタグ付きで登録できる', async () => {
        const { insert, tagsInsert } = buildSupabaseMock();

        const result = await createCertification({
            ...validInput,
            diverNumber: '1234567890',
            instructorNumber: 'I-98765',
            trainedBy: '石垣島ダイビングショップ',
            acquiredLocation: '沖縄県石垣市',
            specialtyTags: 'エンリッチド・エア, ディープ',
        });

        expect(result).toEqual({ success: true, id: 'cert-1' });
        expect(insert).toHaveBeenCalledWith({
            agency: 'padi',
            rank: 'Open Water Diver',
            acquired_on: '2023-04-01',
            diver_number: '1234567890',
            instructor_number: 'I-98765',
            trained_by: '石垣島ダイビングショップ',
            acquired_location: '沖縄県石垣市',
            dive_id: null,
            user_id: 'user-1',
        });
        expect(tagsInsert).toHaveBeenCalledWith([
            { certification_id: 'cert-1', tag: 'エンリッチド・エア' },
            { certification_id: 'cert-1', tag: 'ディープ' },
        ]);
    });

    it('タグの保存に失敗するとエラーを返す', async () => {
        buildSupabaseMock({ tagsInsertError: { message: 'tag insert failed' } });

        const result = await createCertification({ ...validInput, specialtyTags: 'ディープ' });

        expect(result.success).toBe(false);
    });

    it('未ログインなら拒否する', async () => {
        const { insert } = buildSupabaseMock({ user: null });

        const result = await createCertification(validInput);

        expect(result).toEqual({ success: false, error: 'ログインが必要です' });
        expect(insert).not.toHaveBeenCalled();
    });

    it('取得日が生年月日より前なら拒否する', async () => {
        const { insert } = buildSupabaseMock({ birthOn: '2024-01-01' });

        const result = await createCertification(validInput);

        expect(result).toEqual({
            success: false,
            error: '取得日には生年月日以降の日付を入力してください',
        });
        expect(insert).not.toHaveBeenCalled();
    });

    it('取得日が生年月日と同日なら登録できる', async () => {
        buildSupabaseMock({ birthOn: '2023-04-01' });

        const result = await createCertification(validInput);

        expect(result).toEqual({ success: true, id: 'cert-1' });
    });

    it('user_details が取得できない場合はチェックをスキップせず拒否する', async () => {
        const { insert } = buildSupabaseMock({ birthOn: null });

        const result = await createCertification(validInput);

        expect(result.success).toBe(false);
        expect(insert).not.toHaveBeenCalled();
    });

    it('取得日が未来日ならサーバー側でも拒否する', async () => {
        const { insert } = buildSupabaseMock();

        const result = await createCertification({ ...validInput, acquiredOn: '2099-01-01' });

        expect(result).toEqual({
            success: false,
            error: '取得日には今日以前の日付を入力してください',
        });
        expect(insert).not.toHaveBeenCalled();
    });

    it('一意制約違反（23505）は重複エラーメッセージに変換する', async () => {
        buildSupabaseMock({ insertError: { code: '23505', message: 'duplicate key value' } });

        const result = await createCertification(validInput);

        expect(result).toEqual({
            success: false,
            error: '同じ団体・ランクの資格がすでに登録されています',
        });
        expect(revalidatePath).not.toHaveBeenCalled();
    });

    it('その他の DB エラーは汎用メッセージを返す', async () => {
        buildSupabaseMock({ insertError: { message: 'connection error' } });

        const result = await createCertification(validInput);

        expect(result).toEqual({
            success: false,
            error: '資格の登録に失敗しました。時間をおいて再度お試しください',
        });
    });
});

describe('updateCertification', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    it('正常系: 対象 id を更新し、タグを置き換えて一覧を revalidate する', async () => {
        const { update, updateEq, tagsDelete, tagsDeleteEq, tagsInsert } = buildSupabaseMock();

        const result = await updateCertification('cert-1', { ...validInput, rank: 'Advanced Open Water Diver' });

        expect(result).toEqual({ success: true });
        expect(update).toHaveBeenCalledWith({
            agency: 'padi',
            rank: 'Advanced Open Water Diver',
            acquired_on: '2023-04-01',
            diver_number: null,
            instructor_number: null,
            trained_by: null,
            acquired_location: null,
            dive_id: null,
        });
        expect(updateEq).toHaveBeenCalledWith('id', 'cert-1');
        // タグは置き換え（削除 → 入力が空なら挿入なし）
        expect(tagsDelete).toHaveBeenCalled();
        expect(tagsDeleteEq).toHaveBeenCalledWith('certification_id', 'cert-1');
        expect(tagsInsert).not.toHaveBeenCalled();
        expect(revalidatePath).toHaveBeenCalledWith('/settings/certifications');
    });

    it('タグ入力ありの更新では削除後に新しいタグを挿入する', async () => {
        const { tagsDeleteEq, tagsInsert } = buildSupabaseMock();

        const result = await updateCertification('cert-1', { ...validInput, specialtyTags: 'レック、ナイト' });

        expect(result).toEqual({ success: true });
        expect(tagsDeleteEq).toHaveBeenCalledWith('certification_id', 'cert-1');
        expect(tagsInsert).toHaveBeenCalledWith([
            { certification_id: 'cert-1', tag: 'レック' },
            { certification_id: 'cert-1', tag: 'ナイト' },
        ]);
    });

    it('未ログインなら拒否する', async () => {
        const { update } = buildSupabaseMock({ user: null });

        const result = await updateCertification('cert-1', validInput);

        expect(result).toEqual({ success: false, error: 'ログインが必要です' });
        expect(update).not.toHaveBeenCalled();
    });

    it('取得日が生年月日より前なら拒否する', async () => {
        const { update } = buildSupabaseMock({ birthOn: '2024-01-01' });

        const result = await updateCertification('cert-1', validInput);

        expect(result).toEqual({
            success: false,
            error: '取得日には生年月日以降の日付を入力してください',
        });
        expect(update).not.toHaveBeenCalled();
    });

    it('一意制約違反（23505）は重複エラーメッセージに変換する', async () => {
        buildSupabaseMock({ updateError: { code: '23505', message: 'duplicate key value' } });

        const result = await updateCertification('cert-1', validInput);

        expect(result).toEqual({
            success: false,
            error: '同じ団体・ランクの資格がすでに登録されています',
        });
    });

    it('その他の DB エラーは汎用メッセージを返す', async () => {
        buildSupabaseMock({ updateError: { message: 'connection error' } });

        const result = await updateCertification('cert-1', validInput);

        expect(result).toEqual({
            success: false,
            error: '資格の更新に失敗しました。時間をおいて再度お試しください',
        });
    });
});

describe('deleteCertification', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    it('正常系: 対象 id を削除して一覧を revalidate する', async () => {
        const { deleteFn, deleteEq } = buildSupabaseMock();

        const result = await deleteCertification('cert-1');

        expect(result).toEqual({ success: true });
        expect(deleteFn).toHaveBeenCalled();
        expect(deleteEq).toHaveBeenCalledWith('id', 'cert-1');
        expect(revalidatePath).toHaveBeenCalledWith('/settings/certifications');
    });

    it('未ログインなら拒否する', async () => {
        const { deleteFn } = buildSupabaseMock({ user: null });

        const result = await deleteCertification('cert-1');

        expect(result).toEqual({ success: false, error: 'ログインが必要です' });
        expect(deleteFn).not.toHaveBeenCalled();
    });

    it('DB エラーは汎用メッセージを返す', async () => {
        buildSupabaseMock({ deleteError: { message: 'connection error' } });

        const result = await deleteCertification('cert-1');

        expect(result).toEqual({
            success: false,
            error: '資格の削除に失敗しました。時間をおいて再度お試しください',
        });
    });
});
