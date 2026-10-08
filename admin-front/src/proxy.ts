import { type NextRequest, NextResponse } from 'next/server';

import {
    applyNoIndexHeader,
    isNonProductionVercelEnv,
    readBasicAuthCredentials,
    requireBasicAuth,
} from '@/shared/lib/previewProtection';
import { updateSession } from '@/shared/lib/supabase/middleware';

/** 未認証ユーザー向けのパス（認証済みならダッシュボードへ飛ばす） */
const AUTH_ROUTES = ['/login'];

/**
 * 管理画面の一次ガード（多層防御 / SC-001）。
 *
 * admin-front は専用 Cookie を使い、signInAdmin が非管理者を即サインアウトするため、
 * admin-front のセッションを持つ＝管理者である。よってここでは認証レベルのゲートを行い、
 * 管理者本人かの最終確認は (admin) レイアウトの requireAdmin と RLS で担保する。
 */
export const proxy = async (request: NextRequest) => {
    // stg の閲覧制限は Supabase のセッション処理より前に行い、未認証の来訪者に DB を触らせない。
    // 資格情報（BASIC_AUTH_USER / BASIC_AUTH_PASSWORD）は Vercel の Preview スコープにだけ置くので、
    // prod・ローカルでは未設定 = 無効になる。管理画面にはサーバー間通信の受け口が無いため免除パスは無い
    const denied = requireBasicAuth(request, readBasicAuthCredentials());
    if (denied) return denied;

    const { response, user } = await updateSession(request);

    const { pathname } = request.nextUrl;
    const isAuthRoute = AUTH_ROUTES.includes(pathname);

    // 未認証で保護ページにアクセス → ログインへ誘導
    if (!isAuthRoute && !user) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // 認証済みでログインページにアクセス → ダッシュボードへ
    if (isAuthRoute && user) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    // 本番以外（Vercel Preview = stg）は検索エンジンに載せない。metadata の noindex に加え、
    // 独自ドメインを Preview に割り当てたときに Vercel の自動 noindex が外れる分の保険
    return isNonProductionVercelEnv() ? applyNoIndexHeader(response) : response;
};

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
