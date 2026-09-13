import { type NextRequest, NextResponse } from 'next/server';

import { updateSession } from '@/shared/lib/supabase/middleware';

/**
 * 認証必須のパス（プレフィックス一致）。TOP（`/`）はプレフィックスだと全パスに一致するため完全一致で別判定。
 * `/profile-completion` は認証必須だが補完未完了でも到達できるよう AUTH_ROUTES には入れない（016-google-login）。
 * `/update-password` はリセットメールのリカバリーセッション（認証済み）で到達する（001 / FR-019）。
 */
const APP_ROUTE_PREFIXES = [
    '/dives',
    '/dive-sites',
    '/plans',
    '/settings',
    '/profile-completion',
    '/update-password',
    '/notifications',
    '/application-sheet',
    '/shops',
];

/**
 * 未認証ユーザー向けのパス（認証済みなら TOP（`/`）へ飛ばす）。完全一致で判定する。
 *
 * 023 / US2 注記: ログイン 2 段階目の `/login/verify` は「完全一致」ではないため
 * ここには含まれず、AAL1（1 段階目のみ）の認証済みユーザーでも到達できる。
 * 2 要素認証の AAL2 強制（保護ルートの遮断）はミドルウェアではなく
 * `(authenticated)/layout.tsx` で一元的に行う（リクエスト毎の AAL 取得コストと
 * リダイレクトループを避けるための設計判断 / research.md Decision 6）。
 */
const AUTH_ROUTES = ['/login', '/signup', '/reset-password'];

export const proxy = async (request: NextRequest) => {
    const { response, user } = await updateSession(request);

    const { pathname } = request.nextUrl;
    const isAppRoute = pathname === '/' || APP_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
    const isAuthRoute = AUTH_ROUTES.includes(pathname);

    // リダイレクト先はリクエスト元と同じオリジンにする。
    // SITE_URL 基準にすると、別ポートで動くサーバー（Playwright の webServer 等）や
    // SITE_URL とホストが異なる環境で別オリジンへ飛ばしてしまう
    if (isAppRoute && !user) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    if (isAuthRoute && user) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    return response;
};

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
