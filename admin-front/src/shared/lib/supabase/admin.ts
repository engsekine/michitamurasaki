import 'server-only';

import type { Database } from '@repo/supabase';
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * サービスロール権限の Supabase クライアント（023 / FR-016）。
 *
 * Supabase Admin API（`auth.admin.mfa.*` など）は service_role キーが必須。
 * `server-only`。必ず `requireAdmin()` を通過したサーバーアクション内でのみ生成・使用し、
 * クライアントバンドルへは絶対に含めない。RLS を迂回する強い権限のため取り扱いに注意する。
 */
export const createAdminServiceClient = (): SupabaseClient<Database> => {
    const url = process.env['SUPABASE_INTERNAL_URL'] ?? process.env['NEXT_PUBLIC_SUPABASE_URL'];
    const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

    if (!url) {
        throw new Error('環境変数 SUPABASE_INTERNAL_URL または NEXT_PUBLIC_SUPABASE_URL が設定されていません');
    }
    if (!serviceRoleKey) {
        throw new Error('環境変数 SUPABASE_SERVICE_ROLE_KEY が設定されていません');
    }

    return createServiceClient<Database>(url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
};
