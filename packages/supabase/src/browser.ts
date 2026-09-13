import { createBrowserClient } from '@supabase/ssr';

import { AUTH_COOKIE_NAME, AUTH_COOKIE_OPTIONS } from './constants';
import type { Database } from './types';

/**
 * ブラウザ（Client Component）用の Supabase クライアント
 *
 * @param cookieName 認証セッション Cookie 名。既定は利用者向け（service-front）の
 *   `AUTH_COOKIE_NAME`。admin-front は `ADMIN_AUTH_COOKIE_NAME` を渡してセッションを分離する。
 */
export const createClient = (cookieName: string = AUTH_COOKIE_NAME) => {
    const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
    const anonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

    if (!url) {
        throw new Error('環境変数 NEXT_PUBLIC_SUPABASE_URL が設定されていません');
    }
    if (!anonKey) {
        throw new Error('環境変数 NEXT_PUBLIC_SUPABASE_ANON_KEY が設定されていません');
    }

    return createBrowserClient<Database>(url, anonKey, {
        cookieOptions: { ...AUTH_COOKIE_OPTIONS, name: cookieName },
    });
};
