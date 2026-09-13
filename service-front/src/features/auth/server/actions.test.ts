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

import { CURRENT_TERMS_VERSION } from '@/shared/constants/terms';

import {
    type CompleteProfileInput,
    completeProfile,
    resendConfirmationEmail,
    type SignUpInput,
    signInWithGoogle,
    signUp,
    updatePassword,
} from './actions';

interface MockOptions {
    /** signInWithOAuth の戻り */
    oauth?: { data: { url: string | null }; error: { message: string } | null };
    /** getUser の戻り。null は未ログイン */
    user?: { id: string } | null;
    /** user_details への insert の戻り error */
    insertError?: { code?: string; message: string } | null;
    /** is_nickname_taken（rpc）の戻り。true は「既に使われている」 */
    nicknameTaken?: boolean;
    /** auth.resend の戻り error（023）。null は成功 */
    resendError?: { status?: number; message: string } | null;
    /** auth.updateUser の戻り error（001 / updatePassword）。null は成功 */
    updateUserError?: { status?: number; message: string } | null;
}

const buildSupabaseMock = (options: MockOptions = {}) => {
    const {
        oauth = { data: { url: 'https://accounts.google.com/o/oauth2/auth' }, error: null },
        user = { id: 'user-1' },
        insertError = null,
        nicknameTaken = false,
        resendError = null,
    } = options;

    const signInWithOAuth = vi.fn().mockResolvedValue(oauth);
    const getUser = vi.fn().mockResolvedValue({ data: { user } });
    const insert = vi.fn().mockResolvedValue({ error: insertError });
    const rpc = vi.fn().mockResolvedValue({ data: nicknameTaken, error: null });
    const supabaseSignUp = vi
        .fn()
        .mockResolvedValue({ data: { user: { id: 'user-1', identities: [{ id: 'i1' }] } }, error: null });
    /** auth.resend（023 / resendConfirmationEmail）。error を渡すと失敗系を再現する */
    const resend = vi.fn().mockResolvedValue({ data: {}, error: resendError });
    /** auth.updateUser（001 / updatePassword）。error を渡すと失敗系を再現する */
    const updateUser = vi.fn().mockResolvedValue({ data: {}, error: options.updateUserError ?? null });
    const signOut = vi.fn().mockResolvedValue({ error: null });

    return {
        client: {
            auth: { signInWithOAuth, getUser, signUp: supabaseSignUp, resend, updateUser, signOut },
            from: vi.fn().mockReturnValue({ insert }),
            rpc,
        },
        signInWithOAuth,
        insert,
        rpc,
        supabaseSignUp,
        resend,
        updateUser,
        signOut,
    };
};

const signUpInput: SignUpInput = {
    email: 'user@example.com',
    password: 'Password1234',
    lastName: '山田',
    firstName: '太郎',
    lastNameRomaji: 'Yamada',
    firstNameRomaji: 'Taro',
    nickname: 'たろちゃん',
    handle: 'taro-diver',
    birthOn: '1990-01-01',
    gender: 'male',
    heightCm: null,
    weightKg: null,
    agreedToTerms: true,
    diverType: 'general',
    diverNumber: null,
    emailOptIn: false,
};

const profileInput: CompleteProfileInput = {
    lastName: '山田',
    firstName: '太郎',
    lastNameRomaji: 'Yamada',
    firstNameRomaji: 'Taro',
    nickname: 'たろちゃん',
    handle: 'taro-diver',
    birthOn: '1990-01-01',
    gender: 'male',
    heightCm: null,
    weightKg: null,
    agreedToTerms: true,
    diverType: 'general',
    diverNumber: null,
    emailOptIn: false,
};

beforeEach(() => {
    createClient.mockReset();
    redirect.mockClear();
});

describe('signInWithGoogle', () => {
    it('OAuth URL が得られたら Google 同意画面へ redirect する', async () => {
        const mock = buildSupabaseMock();
        createClient.mockResolvedValue(mock.client);

        await expect(signInWithGoogle()).rejects.toThrow('NEXT_REDIRECT:https://accounts.google.com/o/oauth2/auth');

        expect(mock.signInWithOAuth).toHaveBeenCalledWith(
            expect.objectContaining({
                provider: 'google',
                options: expect.objectContaining({
                    redirectTo: expect.stringContaining('/api/auth/callback?next=/'),
                }),
            }),
        );
    });

    it('URL が無い / error の場合は失敗を返す（redirect しない）', async () => {
        createClient.mockResolvedValue(
            buildSupabaseMock({ oauth: { data: { url: null }, error: { message: 'boom' } } }).client,
        );

        const result = await signInWithGoogle();

        expect(result.success).toBe(false);
        expect(redirect).not.toHaveBeenCalled();
    });

    it('authorize URL の内部ホスト（host.docker.internal）をブラウザ可達なホストへ差し替える', async () => {
        vi.stubEnv('SUPABASE_INTERNAL_URL', 'http://host.docker.internal:54321');
        vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
        createClient.mockResolvedValue(
            buildSupabaseMock({
                oauth: {
                    data: { url: 'http://host.docker.internal:54321/auth/v1/authorize?provider=google' },
                    error: null,
                },
            }).client,
        );

        await expect(signInWithGoogle()).rejects.toThrow(
            'NEXT_REDIRECT:http://127.0.0.1:54321/auth/v1/authorize?provider=google',
        );

        vi.unstubAllEnvs();
    });
});

describe('completeProfile', () => {
    it('未ログインなら失敗を返す', async () => {
        createClient.mockResolvedValue(buildSupabaseMock({ user: null }).client);

        const result = await completeProfile(profileInput);

        expect(result.success).toBe(false);
    });

    it('INSERT 成功で TOP へ redirect する', async () => {
        const mock = buildSupabaseMock();
        createClient.mockResolvedValue(mock.client);

        await expect(completeProfile(profileInput)).rejects.toThrow('NEXT_REDIRECT:/');
        expect(mock.insert).toHaveBeenCalledWith(
            expect.objectContaining({ user_id: 'user-1', nickname: 'たろちゃん' }),
        );
    });

    it('PK 重複（補完済み再送）は冪等に TOP へ redirect する', async () => {
        createClient.mockResolvedValue(
            buildSupabaseMock({ insertError: { code: '23505', message: 'duplicate' } }).client,
        );

        await expect(completeProfile(profileInput)).rejects.toThrow('NEXT_REDIRECT:/');
    });

    it('その他の INSERT エラーは失敗を返す', async () => {
        createClient.mockResolvedValue(buildSupabaseMock({ insertError: { code: 'XXXXX', message: 'boom' } }).client);

        const result = await completeProfile(profileInput);

        expect(result.success).toBe(false);
    });

    it('nickname が既に使われている場合は INSERT せず失敗を返す（TOP へ流さない）', async () => {
        const mock = buildSupabaseMock({ nicknameTaken: true });
        createClient.mockResolvedValue(mock.client);

        const result = await completeProfile(profileInput);

        expect(result.success).toBe(false);
        expect(mock.insert).not.toHaveBeenCalled();
        expect(redirect).not.toHaveBeenCalled();
    });

    it('nickname 一意制約違反（競合時 23505）は補完済みと混同せず失敗を返す', async () => {
        createClient.mockResolvedValue(
            buildSupabaseMock({
                insertError: {
                    code: '23505',
                    message: 'duplicate key value violates unique constraint "user_details_nickname_key"',
                },
            }).client,
        );

        const result = await completeProfile(profileInput);

        expect(result.success).toBe(false);
        expect(redirect).not.toHaveBeenCalled();
    });

    it('利用規約未同意なら Supabase に到達せず失敗を返す（018 / FR-008）', async () => {
        const result = await completeProfile({ ...profileInput, agreedToTerms: false });

        expect(result.success).toBe(false);
        expect(createClient).not.toHaveBeenCalled();
    });
});

describe('signUp - 利用規約同意（018）', () => {
    it('未同意なら Supabase に到達せず失敗を返す（FR-008）', async () => {
        const result = await signUp({ ...signUpInput, agreedToTerms: false });

        expect(result.success).toBe(false);
        expect(createClient).not.toHaveBeenCalled();
    });

    it('同意済みなら options.data に terms_version を含めて signUp する', async () => {
        const mock = buildSupabaseMock();
        createClient.mockResolvedValue(mock.client);

        await signUp(signUpInput);

        expect(mock.supabaseSignUp).toHaveBeenCalledWith(
            expect.objectContaining({
                options: expect.objectContaining({
                    data: expect.objectContaining({ terms_version: CURRENT_TERMS_VERSION }),
                }),
            }),
        );
    });

    it('nickname が既に使われている場合は signUp せず失敗を返す', async () => {
        const mock = buildSupabaseMock({ nicknameTaken: true });
        createClient.mockResolvedValue(mock.client);

        const result = await signUp(signUpInput);

        expect(result.success).toBe(false);
        expect(mock.supabaseSignUp).not.toHaveBeenCalled();
    });
});

describe('signUp - メール配信許可（022）', () => {
    it('emailOptIn の値を options.data.email_opt_in に渡す（true）', async () => {
        const mock = buildSupabaseMock();
        createClient.mockResolvedValue(mock.client);

        await signUp({ ...signUpInput, emailOptIn: true });

        expect(mock.supabaseSignUp).toHaveBeenCalledWith(
            expect.objectContaining({
                options: expect.objectContaining({
                    data: expect.objectContaining({ email_opt_in: true }),
                }),
            }),
        );
    });

    it('emailOptIn の値を options.data.email_opt_in に渡す（false）', async () => {
        const mock = buildSupabaseMock();
        createClient.mockResolvedValue(mock.client);

        await signUp({ ...signUpInput, emailOptIn: false });

        expect(mock.supabaseSignUp).toHaveBeenCalledWith(
            expect.objectContaining({
                options: expect.objectContaining({
                    data: expect.objectContaining({ email_opt_in: false }),
                }),
            }),
        );
    });
});

describe('completeProfile - メール配信許可（022）', () => {
    it('emailOptIn=true なら INSERT に is_email_opted_in=true と email_opted_in_at（非 null）を含める', async () => {
        const mock = buildSupabaseMock();
        createClient.mockResolvedValue(mock.client);

        await expect(completeProfile({ ...profileInput, emailOptIn: true })).rejects.toThrow('NEXT_REDIRECT:/');

        const payload = mock.insert.mock.calls[0]?.[0];
        expect(payload.is_email_opted_in).toBe(true);
        expect(typeof payload.email_opted_in_at).toBe('string');
    });

    it('emailOptIn=false なら is_email_opted_in=false と email_opted_in_at=null を含める', async () => {
        const mock = buildSupabaseMock();
        createClient.mockResolvedValue(mock.client);

        await expect(completeProfile({ ...profileInput, emailOptIn: false })).rejects.toThrow('NEXT_REDIRECT:/');

        const payload = mock.insert.mock.calls[0]?.[0];
        expect(payload.is_email_opted_in).toBe(false);
        expect(payload.email_opted_in_at).toBeNull();
    });
});

describe('resendConfirmationEmail', () => {
    it('type=signup と confirmation コールバックの emailRedirectTo で auth.resend を呼ぶ', async () => {
        const mock = buildSupabaseMock();
        createClient.mockResolvedValue(mock.client);

        const result = await resendConfirmationEmail('user@example.com');

        expect(result.success).toBe(true);
        expect(mock.resend).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'signup',
                email: 'user@example.com',
                options: expect.objectContaining({
                    emailRedirectTo: expect.stringContaining('/api/auth/callback?next=/'),
                }),
            }),
        );
    });

    it('レート制限（429）のときは失敗メッセージを返す', async () => {
        createClient.mockResolvedValue(
            buildSupabaseMock({ resendError: { status: 429, message: 'email rate limit exceeded' } }).client,
        );

        const result = await resendConfirmationEmail('user@example.com');

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toContain('しばらく時間をおいて');
        }
    });

    it('レート制限以外のエラーは情報漏洩防止のため成功扱いにする（ユーザー列挙回避）', async () => {
        createClient.mockResolvedValue(buildSupabaseMock({ resendError: { message: 'user not found' } }).client);

        const result = await resendConfirmationEmail('unknown@example.com');

        expect(result.success).toBe(true);
    });
});

describe('updatePassword（001 / FR-019）', () => {
    const VALID_PASSWORD = 'NewPassword123';

    it('パスワードを更新し、サインアウトして /login へリダイレクトする', async () => {
        const mock = buildSupabaseMock();
        createClient.mockResolvedValue(mock.client);

        await expect(updatePassword(VALID_PASSWORD)).rejects.toThrow('NEXT_REDIRECT:/login');

        expect(mock.updateUser).toHaveBeenCalledWith({ password: VALID_PASSWORD });
        expect(mock.signOut).toHaveBeenCalled();
    });

    it('リカバリーセッションが無い場合は更新せず失敗を返す', async () => {
        const mock = buildSupabaseMock({ user: null });
        createClient.mockResolvedValue(mock.client);

        const result = await updatePassword(VALID_PASSWORD);

        expect(result.success).toBe(false);
        expect(mock.updateUser).not.toHaveBeenCalled();
    });

    it('パスワード要件（12文字以上・英大小+数字）をサーバー側でも再検証する', async () => {
        const mock = buildSupabaseMock();
        createClient.mockResolvedValue(mock.client);

        const result = await updatePassword('short');

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toContain('12文字以上');
        }
        expect(mock.updateUser).not.toHaveBeenCalled();
    });

    it('現在と同じパスワードは専用メッセージで拒否する', async () => {
        const mock = buildSupabaseMock({
            updateUserError: { message: 'New password should be different from the old password.' },
        });
        createClient.mockResolvedValue(mock.client);

        const result = await updatePassword(VALID_PASSWORD);

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toContain('現在と同じパスワード');
        }
        expect(mock.signOut).not.toHaveBeenCalled();
    });
});
