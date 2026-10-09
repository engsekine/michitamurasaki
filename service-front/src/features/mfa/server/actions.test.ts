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

import { disableTotpFactor, enrollTotpFactor, getMfaStatus, verifyLogin, verifyTotpFactor } from './actions';

interface FactorStub {
    id: string;
    status: string;
}

interface MfaMockOptions {
    enroll?: {
        data: { id: string; totp: { qr_code: string; secret: string; uri: string } } | null;
        error: { message: string; status?: number } | null;
    };
    challengeAndVerify?: { error: { message: string; status?: number } | null };
    unenroll?: { error: { message: string } | null };
    listFactors?: {
        data: { totp?: FactorStub[]; all?: FactorStub[] } | null;
        error: { message: string } | null;
    };
}

const TOTP = { qr_code: 'data:image/svg+xml;utf-8,<svg/>', secret: 'SECRET123', uri: 'otpauth://totp/x' };

const buildMfaMock = (options: MfaMockOptions = {}) => {
    const {
        enroll = { data: { id: 'factor-1', totp: TOTP }, error: null },
        challengeAndVerify = { error: null },
        unenroll = { error: null },
        listFactors = {
            data: { totp: [{ id: 'factor-1', status: 'verified' }], all: [{ id: 'factor-1', status: 'verified' }] },
            error: null,
        },
    } = options;

    const mfa = {
        enroll: vi.fn().mockResolvedValue(enroll),
        challengeAndVerify: vi.fn().mockResolvedValue(challengeAndVerify),
        unenroll: vi.fn().mockResolvedValue(unenroll),
        listFactors: vi.fn().mockResolvedValue(listFactors),
    };

    return { client: { auth: { mfa } }, mfa };
};

beforeEach(() => {
    createClient.mockReset();
    redirect.mockClear();
});

describe('enrollTotpFactor', () => {
    it('totp で enroll し、factorId / QR コード / シークレットを返す', async () => {
        const mock = buildMfaMock({ listFactors: { data: { totp: [], all: [] }, error: null } });
        createClient.mockResolvedValue(mock.client);

        const result = await enrollTotpFactor();

        expect(mock.mfa.enroll).toHaveBeenCalledWith(expect.objectContaining({ factorType: 'totp' }));
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.factorId).toBe('factor-1');
            expect(result.qrCode).toBe(TOTP.qr_code);
            expect(result.secret).toBe(TOTP.secret);
        }
    });

    it('未検証の totp 要素が残っていれば enroll 前に解除する（friendly name 重複で失敗させない）', async () => {
        const mock = buildMfaMock({
            listFactors: {
                data: { totp: [], all: [{ id: 'stale-1', status: 'unverified' }] },
                error: null,
            },
        });
        createClient.mockResolvedValue(mock.client);

        await enrollTotpFactor();

        expect(mock.mfa.unenroll).toHaveBeenCalledWith({ factorId: 'stale-1' });
        expect(mock.mfa.enroll).toHaveBeenCalled();
    });

    it('enroll 失敗時は失敗を返す', async () => {
        const mock = buildMfaMock({
            listFactors: { data: { totp: [], all: [] }, error: null },
            enroll: { data: null, error: { message: 'totp disabled' } },
        });
        createClient.mockResolvedValue(mock.client);

        const result = await enrollTotpFactor();

        expect(result.success).toBe(false);
    });
});

describe('verifyTotpFactor', () => {
    it('challengeAndVerify 成功で成功を返す', async () => {
        const mock = buildMfaMock();
        createClient.mockResolvedValue(mock.client);

        const result = await verifyTotpFactor('factor-1', '123456');

        expect(mock.mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'factor-1', code: '123456' });
        expect(result.success).toBe(true);
    });

    it('誤コードは失敗を返す', async () => {
        const mock = buildMfaMock({ challengeAndVerify: { error: { message: 'invalid code' } } });
        createClient.mockResolvedValue(mock.client);

        const result = await verifyTotpFactor('factor-1', '000000');

        expect(result.success).toBe(false);
    });
});

describe('disableTotpFactor', () => {
    it('unenroll を呼んで成功を返す', async () => {
        const mock = buildMfaMock();
        createClient.mockResolvedValue(mock.client);

        const result = await disableTotpFactor('factor-1');

        expect(mock.mfa.unenroll).toHaveBeenCalledWith({ factorId: 'factor-1' });
        expect(result.success).toBe(true);
    });
});

describe('getMfaStatus', () => {
    it('verified な totp 要素があれば enabled=true と factorId を返す', async () => {
        createClient.mockResolvedValue(buildMfaMock().client);

        const status = await getMfaStatus();

        expect(status).toEqual({ enabled: true, factorId: 'factor-1' });
    });

    it('totp 要素が無ければ enabled=false / factorId=null', async () => {
        createClient.mockResolvedValue(
            buildMfaMock({ listFactors: { data: { totp: [], all: [] }, error: null } }).client,
        );

        const status = await getMfaStatus();

        expect(status).toEqual({ enabled: false, factorId: null });
    });

    it('取得失敗時は安全側（無効扱い）を返す', async () => {
        createClient.mockResolvedValue(
            buildMfaMock({ listFactors: { data: null, error: { message: 'network' } } }).client,
        );

        const status = await getMfaStatus();

        expect(status).toEqual({ enabled: false, factorId: null });
    });
});

describe('verifyLogin', () => {
    it('challengeAndVerify 成功で TOP へ redirect する', async () => {
        const mock = buildMfaMock();
        createClient.mockResolvedValue(mock.client);

        await expect(verifyLogin('factor-1', '123456')).rejects.toThrow('NEXT_REDIRECT:/');
        expect(mock.mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'factor-1', code: '123456' });
    });

    it('誤コードは redirect せず失敗を返す', async () => {
        const mock = buildMfaMock({ challengeAndVerify: { error: { message: 'invalid code' } } });
        createClient.mockResolvedValue(mock.client);

        const result = await verifyLogin('factor-1', '000000');

        expect(result.success).toBe(false);
        expect(redirect).not.toHaveBeenCalled();
    });

    it('レート制限（429）は再試行待ちメッセージを返す', async () => {
        const mock = buildMfaMock({ challengeAndVerify: { error: { message: 'rate', status: 429 } } });
        createClient.mockResolvedValue(mock.client);

        const result = await verifyLogin('factor-1', '123456');

        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toContain('しばらく時間をおいて');
    });
});
