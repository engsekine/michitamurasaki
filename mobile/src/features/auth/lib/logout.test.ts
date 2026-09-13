import { describe, expect, it, vi } from 'vitest';

import { executeLogout, planLogout } from './logout';

describe('planLogout', () => {
    it('未転送が 0 件なら確認不要', () => {
        expect(planLogout(0)).toEqual({ requiresConfirmation: false, pendingCount: 0 });
    });

    it('未転送があれば確認必須（データ消失の警告 / spec Edge Case）', () => {
        expect(planLogout(3)).toEqual({ requiresConfirmation: true, pendingCount: 3 });
    });
});

describe('executeLogout', () => {
    it('端末データ削除 → サインアウトの順で実行する（FR-019）', async () => {
        const calls: string[] = [];
        const deleteUserData = vi.fn(async () => {
            calls.push('delete');
        });
        const signOut = vi.fn(async () => {
            calls.push('signOut');
        });

        await executeLogout({ deleteUserData, signOut });

        expect(calls).toEqual(['delete', 'signOut']);
    });

    it('データ削除に失敗したらサインアウトしない（データを残したまま再試行できる）', async () => {
        const deleteUserData = vi.fn(async () => {
            throw new Error('disk error');
        });
        const signOut = vi.fn();

        await expect(executeLogout({ deleteUserData, signOut })).rejects.toThrow('disk error');
        expect(signOut).not.toHaveBeenCalled();
    });
});
