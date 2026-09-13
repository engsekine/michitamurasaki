import type { User } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import { MFA_REQUIRED_MESSAGE, requireUser } from './requireUser';

const buildClient = (user: User | null, aal: string | null = 'aal1') => ({
    auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: user ? null : { message: 'unauthenticated' } }),
        getClaims: vi.fn().mockResolvedValue({ data: { claims: { aal } }, error: null }),
    },
});

const verifiedFactor = { id: 'factor-1', status: 'verified' } as NonNullable<User['factors']>[number];

describe('requireUser', () => {
    it('ログイン済みなら user を返し failure は null', async () => {
        const user = { id: 'user-1' } as User;
        const result = await requireUser(buildClient(user));

        expect(result.failure).toBeNull();
        expect(result.user).toEqual(user);
    });

    it('未ログインなら ActionResult 互換の失敗を返す', async () => {
        const result = await requireUser(buildClient(null));

        expect(result.user).toBeNull();
        expect(result.failure).toEqual({ success: false, error: 'ログインが必要です' });
    });

    it('2 要素認証を有効化したユーザーが 1 段階目のみ（aal1）なら失敗を返す（Server Action からの回避防止）', async () => {
        const user = { id: 'user-1', factors: [verifiedFactor] } as User;
        const result = await requireUser(buildClient(user, 'aal1'));

        expect(result.user).toBeNull();
        expect(result.failure).toEqual({ success: false, error: MFA_REQUIRED_MESSAGE });
    });

    it('2 要素認証を完了（aal2）していれば user を返す', async () => {
        const user = { id: 'user-1', factors: [verifiedFactor] } as User;
        const result = await requireUser(buildClient(user, 'aal2'));

        expect(result.failure).toBeNull();
        expect(result.user).toEqual(user);
    });

    it('2 要素認証未登録のユーザーはクレーム取得を行わない（体験不変）', async () => {
        const client = buildClient({ id: 'user-1', factors: [] } as unknown as User);
        await requireUser(client);

        expect(client.auth.getClaims).not.toHaveBeenCalled();
    });
});
