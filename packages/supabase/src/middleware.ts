import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

import { AUTH_COOKIE_NAME, AUTH_COOKIE_OPTIONS } from './constants';
import type { Database } from './types';

/**
 * Middleware 用の Supabase クライアント（セッション更新）
 *
 * @param request NextRequest
 * @param cookieName 認証セッション Cookie 名。既定は `AUTH_COOKIE_NAME`。
 *   admin-front は `ADMIN_AUTH_COOKIE_NAME` を渡してセッションを分離する。
 */
export const updateSession = async (request: NextRequest, cookieName: string = AUTH_COOKIE_NAME) => {
    let supabaseResponse = NextResponse.next({ request });

    const url = process.env['SUPABASE_INTERNAL_URL'] ?? process.env['NEXT_PUBLIC_SUPABASE_URL'];
    const anonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

    if (!url) {
        throw new Error('環境変数 SUPABASE_INTERNAL_URL または NEXT_PUBLIC_SUPABASE_URL が設定されていません');
    }
    if (!anonKey) {
        throw new Error('環境変数 NEXT_PUBLIC_SUPABASE_ANON_KEY が設定されていません');
    }

    const supabase = createServerClient<Database>(url, anonKey, {
        cookieOptions: { ...AUTH_COOKIE_OPTIONS, name: cookieName },
        cookies: {
            getAll: () => request.cookies.getAll(),
            setAll: (cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) => {
                for (const { name, value } of cookiesToSet) {
                    request.cookies.set(name, value);
                }
                supabaseResponse = NextResponse.next({ request });
                for (const { name, value, options } of cookiesToSet) {
                    supabaseResponse.cookies.set(name, value, options);
                }
            },
        },
    });

    /** セッションを更新（期限切れトークンのリフレッシュ） */
    const {
        data: { user },
    } = await supabase.auth.getUser();

    return { response: supabaseResponse, user };
};
