import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireAdmin, createClient, createAdminServiceClient, recordAudit } = vi.hoisted(() => ({
    requireAdmin: vi.fn(),
    createClient: vi.fn(),
    createAdminServiceClient: vi.fn(),
    recordAudit: vi.fn(),
}));

vi.mock('@/features/admin-auth', () => ({ requireAdmin }));
vi.mock('@/shared/lib/supabase/server', () => ({ createClient }));
vi.mock('@/shared/lib/supabase/admin', () => ({ createAdminServiceClient }));
vi.mock('@/shared/lib/audit/recordAudit', () => ({ recordAudit }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { MFA_REMOVE_SUPERADMIN_ONLY_MESSAGE, removeMfaFactor } from './actions';

/** 対象ユーザー（UUID 形式でないと形式チェックで弾かれる） */
const USER_ID = '0b8f4e2a-1111-4222-8333-444444444444';

interface ServiceMockOptions {
    factors?: { id: string; status: string }[];
    listError?: { message: string } | null;
    deleteError?: { message: string } | null;
}

const buildServiceMock = (options: ServiceMockOptions = {}) => {
    const { factors = [{ id: 'factor-1', status: 'verified' }], listError = null, deleteError = null } = options;
    const listFactors = vi.fn().mockResolvedValue({ data: { factors }, error: listError });
    const deleteFactor = vi.fn().mockResolvedValue({ data: {}, error: deleteError });
    return { client: { auth: { admin: { mfa: { listFactors, deleteFactor } } } }, listFactors, deleteFactor };
};

beforeEach(() => {
    requireAdmin.mockReset();
    createClient.mockReset();
    createAdminServiceClient.mockReset();
    recordAudit.mockReset();
    requireAdmin.mockResolvedValue({ id: 'admin-1', role: 'superadmin' });
    createClient.mockResolvedValue({});
});

describe('removeMfaFactor（FR-016）', () => {
    it('一般 admin は実行できない（superadmin 限定。Admin API も呼ばない）', async () => {
        requireAdmin.mockResolvedValue({ id: 'admin-1', role: 'admin' });
        const service = buildServiceMock();
        createAdminServiceClient.mockReturnValue(service.client);

        const result = await removeMfaFactor(USER_ID);

        expect(result).toEqual({ success: false, error: MFA_REMOVE_SUPERADMIN_ONLY_MESSAGE });
        expect(service.listFactors).not.toHaveBeenCalled();
        expect(service.deleteFactor).not.toHaveBeenCalled();
        expect(recordAudit).not.toHaveBeenCalled();
    });

    it('userId が UUID 形式でなければ Admin API を呼ばずに失敗を返す', async () => {
        const service = buildServiceMock();
        createAdminServiceClient.mockReturnValue(service.client);

        const result = await removeMfaFactor('../admin');

        expect(result.success).toBe(false);
        expect(service.listFactors).not.toHaveBeenCalled();
    });

    it('全 MFA 要素を削除し、監査ログを hard_delete で記録して成功を返す', async () => {
        const service = buildServiceMock({
            factors: [
                { id: 'factor-1', status: 'verified' },
                { id: 'factor-2', status: 'unverified' },
            ],
        });
        createAdminServiceClient.mockReturnValue(service.client);

        const result = await removeMfaFactor(USER_ID);

        expect(result).toEqual({ success: true });
        expect(service.deleteFactor).toHaveBeenCalledTimes(2);
        expect(service.deleteFactor).toHaveBeenCalledWith({ id: 'factor-1', userId: USER_ID });
        expect(service.deleteFactor).toHaveBeenCalledWith({ id: 'factor-2', userId: USER_ID });
        expect(recordAudit).toHaveBeenCalledWith(
            {},
            'admin-1',
            expect.objectContaining({ action: 'hard_delete', targetTable: 'mfa_factors', targetId: USER_ID }),
        );
    });

    it('要素が無いユーザーは失敗を返し、削除も監査もしない', async () => {
        const service = buildServiceMock({ factors: [] });
        createAdminServiceClient.mockReturnValue(service.client);

        const result = await removeMfaFactor(USER_ID);

        expect(result.success).toBe(false);
        expect(service.deleteFactor).not.toHaveBeenCalled();
        expect(recordAudit).not.toHaveBeenCalled();
    });

    it('listFactors がエラーなら失敗を返す', async () => {
        const service = buildServiceMock({ listError: { message: 'boom' } });
        createAdminServiceClient.mockReturnValue(service.client);

        const result = await removeMfaFactor(USER_ID);

        expect(result.success).toBe(false);
        expect(service.deleteFactor).not.toHaveBeenCalled();
    });

    it('deleteFactor が失敗したら監査せず失敗を返す', async () => {
        const service = buildServiceMock({ deleteError: { message: 'boom' } });
        createAdminServiceClient.mockReturnValue(service.client);

        const result = await removeMfaFactor(USER_ID);

        expect(result.success).toBe(false);
        expect(recordAudit).not.toHaveBeenCalled();
    });

    it('一部だけ削除できて途中で失敗した場合、削除済み要素のみ監査ログに残して失敗を返す', async () => {
        const deleteFactor = vi
            .fn()
            .mockResolvedValueOnce({ data: {}, error: null })
            .mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
        const listFactors = vi.fn().mockResolvedValue({
            data: {
                factors: [
                    { id: 'factor-1', status: 'verified' },
                    { id: 'factor-2', status: 'unverified' },
                ],
            },
            error: null,
        });
        createAdminServiceClient.mockReturnValue({ auth: { admin: { mfa: { listFactors, deleteFactor } } } });

        const result = await removeMfaFactor(USER_ID);

        expect(result.success).toBe(false);
        /** 削除できた factor-1 のみ証跡として残す（factor-2 は削除失敗のため含めない） */
        expect(recordAudit).toHaveBeenCalledWith(
            {},
            'admin-1',
            expect.objectContaining({
                action: 'hard_delete',
                targetTable: 'mfa_factors',
                targetId: USER_ID,
                changes: { removedFactorIds: ['factor-1'] },
            }),
        );
    });

    it('監査ログの記録に失敗しても、削除が成功していれば成功を返す', async () => {
        const service = buildServiceMock();
        createAdminServiceClient.mockReturnValue(service.client);
        recordAudit.mockRejectedValue(new Error('audit down'));

        const result = await removeMfaFactor(USER_ID);

        expect(result.success).toBe(true);
    });

    it('未認証・非管理者は requireAdmin でリダイレクトされる（ここでは例外）', async () => {
        requireAdmin.mockRejectedValue(new Error('NEXT_REDIRECT:/login'));

        await expect(removeMfaFactor(USER_ID)).rejects.toThrow('NEXT_REDIRECT:/login');
        expect(createAdminServiceClient).not.toHaveBeenCalled();
    });
});
