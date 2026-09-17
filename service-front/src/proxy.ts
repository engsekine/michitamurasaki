import { type NextRequest, NextResponse } from 'next/server';

import {
    applyNoIndexHeader,
    isNonProductionVercelEnv,
    readBasicAuthCredentials,
    requireBasicAuth,
} from '@/shared/lib/previewProtection';
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

/**
 * stg の Basic 認証を免除するパス（プレフィックス一致）。
 * Stripe の webhook はサーバー間通信で資格情報を付けられない（署名検証で守られている）。
 * Supabase の認証コールバック（`/api/auth/callback`）はブラウザ経由で到達するので免除しない。
 */
const BASIC_AUTH_EXCLUDED_PATH_PREFIXES = ['/api/stripe/webhook'];

export const proxy = async (request: NextRequest) => {
    // stg の閲覧制限は Supabase のセッション処理より前に行い、未認証の来訪者に DB を触らせない。
    // 資格情報（BASIC_AUTH_USER / BASIC_AUTH_PASSWORD）は Vercel の Preview スコープにだけ置くので、
    // prod・ローカルでは未設定 = 無効になる
    const denied = requireBasicAuth(request, readBasicAuthCredentials(), BASIC_AUTH_EXCLUDED_PATH_PREFIXES);
    if (denied) return denied;

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

    // 本番以外（Vercel Preview = stg）は検索エンジンに載せない。独自ドメインを Preview に
    // 割り当てると Vercel の自動 noindex が付かなくなるため、アプリ側でも保険として付ける
    return isNonProductionVercelEnv() ? applyNoIndexHeader(response) : response;
};

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
