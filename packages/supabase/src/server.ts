import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { AUTH_COOKIE_NAME, AUTH_COOKIE_OPTIONS } from './constants';
import type { Database } from './types';

/**
 * Server Component / Route Handler 用の Supabase クライアント
 *
 * Docker コンテナ内から接続する場合、ブラウザ側で使う `NEXT_PUBLIC_SUPABASE_URL`
 * （`http://localhost:54321` 等）はコンテナ内では解決できない。コンテナ内専用 URL
 * （`http://host.docker.internal:54321` 等）を `SUPABASE_INTERNAL_URL` に設定し、
 * サーバー側ではそちらを優先する。
 */
export const createClient = async (cookieName: string = AUTH_COOKIE_NAME) => {
    const cookieStore = await cookies();

    const url = process.env['SUPABASE_INTERNAL_URL'] ?? process.env['NEXT_PUBLIC_SUPABASE_URL'];
    const anonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

    if (!url) {
        throw new Error('環境変数 SUPABASE_INTERNAL_URL または NEXT_PUBLIC_SUPABASE_URL が設定されていません');
    }
    if (!anonKey) {
        throw new Error('環境変数 NEXT_PUBLIC_SUPABASE_ANON_KEY が設定されていません');
    }

    return createServerClient<Database>(url, anonKey, {
        cookieOptions: { ...AUTH_COOKIE_OPTIONS, name: cookieName },
        cookies: {
            getAll: () => cookieStore.getAll(),
            setAll: (cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) => {
                for (const { name, value, options } of cookiesToSet) {
                    cookieStore.set(name, value, options);
                }
            },
        },
    });
};
