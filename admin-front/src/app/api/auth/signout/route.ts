import { type NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/shared/lib/supabase/server';

/**
 * 非管理者セッションの破棄用エンドポイント（requireAdmin の失敗時遷移先）。
 * 「認証済みだが admin_users に行がない」セッションを残すと
 * /login ↔ / の無限リダイレクトになるため、ここで signOut してからログインへ返す。
 * （Server Component のレンダリング中は Cookie を変更できないため Route Handler で行う）
 *
 * GET で状態を変えるため、他サイトからの `<img src>` 等によるログアウト CSRF を防ぐ目的で
 * Sec-Fetch-Site がクロスサイトのリクエストは拒否する（同一オリジン遷移・直接入力は通す）。
 * signOut は scope: 'local' とし、admin-front の Cookie のみ破棄する（既定の 'global' は
 * 同一 auth.users の全端末・service-front のセッションまで失効させてしまう）。
 */
export const GET = async (request: NextRequest) => {
    const fetchSite = request.headers.get('sec-fetch-site');
    if (fetchSite === 'cross-site') {
        return new NextResponse('forbidden', { status: 403 });
    }

    const supabase = await createClient();
    await supabase.auth.signOut({ scope: 'local' });

    return NextResponse.redirect(new URL('/login', request.url));
};
