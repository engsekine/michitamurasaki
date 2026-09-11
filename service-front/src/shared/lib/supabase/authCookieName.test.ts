/**
 * 認証 Cookie 名の回帰テスト。
 *
 * サーバー側（SUPABASE_INTERNAL_URL）とブラウザ側（NEXT_PUBLIC_SUPABASE_URL)で
 * 接続先ホスト名が異なる構成（Docker 開発環境）では、@supabase/ssr のデフォルト
 * Cookie 名がクライアントごとに食い違い、ブラウザクライアントがセッションを
 * 読めず anon になる（RLS で全行除外され検索が常に 0 件になる）バグがあった。
 * 全クライアントが共通の AUTH_COOKIE_NAME を明示することを保証する。
 */
import { AUTH_COOKIE_NAME, AUTH_COOKIE_OPTIONS } from '@repo/supabase/constants';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createBrowserClient, createServerClient } = vi.hoisted(() => ({
    createBrowserClient: vi.fn(),
    createServerClient: vi.fn(() => ({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    })),
}));

vi.mock('@supabase/ssr', () => ({ createBrowserClient, createServerClient }));
vi.mock('next/headers', () => ({
    cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: vi.fn() }),
}));
vi.mock('next/server', () => ({
    NextResponse: { next: vi.fn(() => ({ cookies: { set: vi.fn() } })) },
}));

describe('Supabase クライアントの認証 Cookie 名', () => {
    beforeEach(() => {
        vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
        vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
        vi.stubEnv('SUPABASE_INTERNAL_URL', 'http://host.docker.internal:54321');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.clearAllMocks();
    });

    it('ブラウザクライアントが共通 Cookie 名を明示している', async () => {
        const { createClient } = await import('@repo/supabase/browser');
        createClient();

        expect(createBrowserClient).toHaveBeenCalledWith(
            'http://127.0.0.1:54321',
            'test-anon-key',
            expect.objectContaining({ cookieOptions: { ...AUTH_COOKIE_OPTIONS, name: AUTH_COOKIE_NAME } }),
        );
    });

    it('サーバークライアントが共通 Cookie 名を明示している', async () => {
        const { createClient } = await import('@repo/supabase/server');
        await createClient();

        expect(createServerClient).toHaveBeenCalledWith(
            'http://host.docker.internal:54321',
            'test-anon-key',
            expect.objectContaining({ cookieOptions: { ...AUTH_COOKIE_OPTIONS, name: AUTH_COOKIE_NAME } }),
        );
    });

    it('middleware クライアントが共通 Cookie 名を明示している', async () => {
        const { updateSession } = await import('@repo/supabase/middleware');
        const fakeRequest = { cookies: { getAll: () => [], set: vi.fn() } };
        await updateSession(fakeRequest as never);

        expect(createServerClient).toHaveBeenCalledWith(
            'http://host.docker.internal:54321',
            'test-anon-key',
            expect.objectContaining({ cookieOptions: { ...AUTH_COOKIE_OPTIONS, name: AUTH_COOKIE_NAME } }),
        );
    });
});

describe('認証 Cookie の共通属性', () => {
    it('path / sameSite を固定し、本番のみ Secure を付ける', () => {
        expect(AUTH_COOKIE_OPTIONS.path).toBe('/');
        expect(AUTH_COOKIE_OPTIONS.sameSite).toBe('lax');
        // テスト環境（NODE_ENV=test）では false。本番では true になる（http:// への平文送信を防ぐ）
        expect(AUTH_COOKIE_OPTIONS.secure).toBe(process.env['NODE_ENV'] === 'production');
    });
});
