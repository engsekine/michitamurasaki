import 'react-native-url-polyfill/auto';

import type { Database } from '@repo/supabase';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

/**
 * セッションを OS キーチェーン（SecureStore）に永続化するアダプタ（FR-019 / research R6）。
 * AsyncStorage と違い平文でディスクに残らない。
 */
const secureStoreAdapter = {
    getItem: (key: string) => SecureStore.getItemAsync(key),
    setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
    removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[supabase] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY が未設定です');
}

/**
 * モバイル用 Supabase クライアント（anon キーのみ / RLS 前提）。
 * detectSessionInUrl はネイティブでは無効（OAuth コールバックは AuthSession 側で処理）。
 */
export const supabase: SupabaseClient<Database> = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: secureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        // Google ログイン（AuthSession）の認可コード交換に PKCE を使う（research R6）
        flowType: 'pkce',
    },
});
