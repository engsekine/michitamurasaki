import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClient = vi.fn();
const redirect = vi.fn((url: string) => {
    /** 本物の redirect は throw して以降を中断するため、テストでも同様に振る舞わせる */
    throw new Error(`NEXT_REDIRECT:${url}`);
});

vi.mock('next/navigation', () => ({
    redirect: (url: string) => redirect(url),
}));

vi.mock('@/shared/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => createClient(...args),
}));

import {
    challengeLoginFactor,
    disablePhoneFactor,
    enrollPhoneFactor,
    getMfaStatus,
    verifyLogin,
    verifyPhoneFactor,
} from './actions';

interface MfaMockOptions {
    enroll?: { data: { id: string } | null; error: { message: string; status?: number } | null };
    challenge?: { data: { id: string } | null; error: { message: string; status?: number } | null };
    verify?: { error: { message: string } | null };
    unenroll?: { error: { message: string } | null };
    listFactors?: {
        data: { phone?: { id: string; status: string }[] } | null;
        error: { message: string } | null;
    };
}

const buildMfaMock = (options: MfaMockOptions = {}) => {
    const {
        enroll = { data: { id: 'factor-1' }, error: null },
        challenge = { data: { id: 'challenge-1' }, error: null },
        verify = { error: null },
        unenroll = { error: null },
        listFactors = { data: { phone: [{ id: 'factor-1', status: 'verified' }] }, error: null },
    } = options;

    const mfa = {
        enroll: vi.fn().mockResolvedValue(enroll),
        challenge: vi.fn().mockResolvedValue(challenge),
        verify: vi.fn().mockResolvedValue(verify),
        unenroll: vi.fn().mockResolvedValue(unenroll),
        listFactors: vi.fn().mockResolvedValue(listFactors),
    };

    return { client: { auth: { mfa } }, mfa };
};

beforeEach(() => {
    createClient.mockReset();
    redirect.mockClear();
});

describe('enrollPhoneFactor', () => {
    it('enroll → challenge を呼び、factorId / challengeId を返す', async () => {
        const mock = buildMfaMock();
        createClient.mockResolvedValue(mock.client);

        const result = await enrollPhoneFactor('+819012345678');

        expect(mock.mfa.enroll).toHaveBeenCalledWith({ factorType: 'phone', phone: '+819012345678' });
        expect(mock.mfa.challenge).toHaveBeenCalledWith({ factorId: 'factor-1' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.factorId).toBe('factor-1');
            expect(result.challengeId).toBe('challenge-1');
        }
    });

    it('enroll 失敗時は challenge せず失敗を返す', async () => {
        const mock = buildMfaMock({ enroll: { data: null, error: { message: 'invalid phone' } } });
        createClient.mockResolvedValue(mock.client);

        const result = await enrollPhoneFactor('+81');

        expect(result.success).toBe(false);
        expect(mock.mfa.challenge).not.toHaveBeenCalled();
    });
});

describe('verifyPhoneFactor', () => {
    it('verify 成功で成功を返す', async () => {
        const mock = buildMfaMock();
        createClient.mockResolvedValue(mock.client);

        const result = await verifyPhoneFactor('factor-1', 'challenge-1', '123456');

        expect(mock.mfa.verify).toHaveBeenCalledWith({
            factorId: 'factor-1',
            challengeId: 'challenge-1',
            code: '123456',
        });
        expect(result.success).toBe(true);
    });

    it('誤コードは失敗を返す', async () => {
        const mock = buildMfaMock({ verify: { error: { message: 'invalid code' } } });
        createClient.mockResolvedValue(mock.client);

        const result = await verifyPhoneFactor('factor-1', 'challenge-1', '000000');

        expect(result.success).toBe(false);
    });
});

describe('disablePhoneFactor', () => {
    it('unenroll を呼んで成功を返す', async () => {
        const mock = buildMfaMock();
        createClient.mockResolvedValue(mock.client);

        const result = await disablePhoneFactor('factor-1');

        expect(mock.mfa.unenroll).toHaveBeenCalledWith({ factorId: 'factor-1' });
        expect(result.success).toBe(true);
    });
});

describe('getMfaStatus', () => {
    it('verified な phone 要素があれば enabled=true と factorId を返す', async () => {
        createClient.mockResolvedValue(buildMfaMock().client);

        const status = await getMfaStatus();

        expect(status).toEqual({ enabled: true, factorId: 'factor-1' });
    });

    it('phone 要素が無ければ enabled=false / factorId=null', async () => {
        createClient.mockResolvedValue(buildMfaMock({ listFactors: { data: { phone: [] }, error: null } }).client);

        const status = await getMfaStatus();

        expect(status).toEqual({ enabled: false, factorId: null });
    });
});

describe('challengeLoginFactor', () => {
    it('challenge を呼び challengeId を返す', async () => {
        const mock = buildMfaMock();
        createClient.mockResolvedValue(mock.client);

        const result = await challengeLoginFactor('factor-1');

        expect(mock.mfa.challenge).toHaveBeenCalledWith({ factorId: 'factor-1' });
        expect(result.success).toBe(true);
        if (result.success) expect(result.challengeId).toBe('challenge-1');
    });

    it('レート制限（429）は再送待ちメッセージを返す', async () => {
        const mock = buildMfaMock({ challenge: { data: null, error: { message: 'rate', status: 429 } } });
        createClient.mockResolvedValue(mock.client);

        const result = await challengeLoginFactor('factor-1');

        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toContain('しばらく時間をおいて');
    });
});

describe('verifyLogin', () => {
    it('verify 成功で TOP へ redirect する', async () => {
        const mock = buildMfaMock();
        createClient.mockResolvedValue(mock.client);

        await expect(verifyLogin('factor-1', 'challenge-1', '123456')).rejects.toThrow('NEXT_REDIRECT:/');
    });

    it('誤コードは redirect せず失敗を返す', async () => {
        const mock = buildMfaMock({ verify: { error: { message: 'invalid code' } } });
        createClient.mockResolvedValue(mock.client);

        const result = await verifyLogin('factor-1', 'challenge-1', '000000');

        expect(result.success).toBe(false);
        expect(redirect).not.toHaveBeenCalled();
    });
});
