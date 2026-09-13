import type { User } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import { getVerifiedAalLevels, isMfaChallengePending } from './aalGuard';

describe('isMfaChallengePending', () => {
    it('aal1 → aal2 のとき保留中（遮断すべき）と判定する', () => {
        expect(isMfaChallengePending({ currentLevel: 'aal1', nextLevel: 'aal2' })).toBe(true);
    });

    it('未有効化（aal1 → aal1）は保留中ではない（体験不変 / FR-015）', () => {
        expect(isMfaChallengePending({ currentLevel: 'aal1', nextLevel: 'aal1' })).toBe(false);
    });

    it('2 段階目完了（aal2）は保留中ではない', () => {
        expect(isMfaChallengePending({ currentLevel: 'aal2', nextLevel: 'aal2' })).toBe(false);
    });

    it('MFA 有効で現在レベルが不明（null）なら保留中扱い（fail-closed）', () => {
        expect(isMfaChallengePending({ currentLevel: null, nextLevel: 'aal2' })).toBe(true);
    });

    it('null（未認証）は保留中扱いしない', () => {
        expect(isMfaChallengePending(null)).toBe(false);
    });
});

describe('getVerifiedAalLevels（改ざん不能な情報から判定する）', () => {
    const buildClient = (options: {
        user: Partial<User> | null;
        claims?: { aal?: unknown } | null;
        claimsError?: unknown;
    }) => {
        const getUser = vi.fn().mockResolvedValue({
            data: { user: options.user },
            error: options.user ? null : { message: 'unauthenticated' },
        });
        const getClaims = vi
            .fn()
            .mockResolvedValue(
                options.claimsError
                    ? { data: null, error: options.claimsError }
                    : { data: { claims: options.claims ?? {} }, error: null },
            );
        return { client: { auth: { getUser, getClaims } }, getUser, getClaims };
    };

    it('未認証なら null', async () => {
        const { client } = buildClient({ user: null });
        expect(await getVerifiedAalLevels(client)).toBeNull();
    });

    it('verified な要素が無ければクレームを取らずに aal1/aal1 を返す', async () => {
        const { client, getClaims } = buildClient({ user: { id: 'u1', factors: [] } });
        expect(await getVerifiedAalLevels(client)).toEqual({ currentLevel: 'aal1', nextLevel: 'aal1' });
        expect(getClaims).not.toHaveBeenCalled();
    });

    it('unverified な要素しか無い場合も 2 段階目は不要', async () => {
        const { client } = buildClient({
            user: { id: 'u1', factors: [{ id: 'f1', status: 'unverified' } as NonNullable<User['factors']>[number]] },
        });
        expect(await getVerifiedAalLevels(client)).toEqual({ currentLevel: 'aal1', nextLevel: 'aal1' });
    });

    it('verified な要素があり JWT クレームが aal1 なら保留中（aal1 → aal2）', async () => {
        const { client } = buildClient({
            user: { id: 'u1', factors: [{ id: 'f1', status: 'verified' } as NonNullable<User['factors']>[number]] },
            claims: { aal: 'aal1' },
        });
        const levels = await getVerifiedAalLevels(client);
        expect(levels).toEqual({ currentLevel: 'aal1', nextLevel: 'aal2' });
        expect(isMfaChallengePending(levels)).toBe(true);
    });

    it('verified な要素があり JWT クレームが aal2 なら完了', async () => {
        const { client } = buildClient({
            user: { id: 'u1', factors: [{ id: 'f1', status: 'verified' } as NonNullable<User['factors']>[number]] },
            claims: { aal: 'aal2' },
        });
        expect(isMfaChallengePending(await getVerifiedAalLevels(client))).toBe(false);
    });

    it('クレーム取得に失敗したら currentLevel は null（呼び出し側で fail-closed）', async () => {
        const { client } = buildClient({
            user: { id: 'u1', factors: [{ id: 'f1', status: 'verified' } as NonNullable<User['factors']>[number]] },
            claimsError: { message: 'jwks unavailable' },
        });
        const levels = await getVerifiedAalLevels(client);
        expect(levels).toEqual({ currentLevel: null, nextLevel: 'aal2' });
        expect(isMfaChallengePending(levels)).toBe(true);
    });

    it('検証済み user を渡した場合は getUser を呼ばず、jwt を渡した場合は getClaims に引き継ぐ', async () => {
        const { client, getUser, getClaims } = buildClient({ user: { id: 'u1' }, claims: { aal: 'aal2' } });
        const user = { id: 'u1', factors: [{ id: 'f1', status: 'verified' }] } as unknown as User;
        await getVerifiedAalLevels(client, { user, jwt: 'token-123' });
        expect(getUser).not.toHaveBeenCalled();
        expect(getClaims).toHaveBeenCalledWith('token-123');
    });
});
