import type { NextConfig } from 'next';

/**
 * admin-front の Next.js 設定。
 * Supabase へブラウザから接続するため connect-src に Supabase の origin を許可する。
 * 管理画面は検索エンジンに載せないため、X-Robots-Tag で noindex を付与する。
 */
const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : '';
const supabaseWsOrigin = supabaseOrigin.replace(/^http/, 'ws');
const connectSrc = ["'self'", supabaseOrigin, supabaseWsOrigin].filter(Boolean).join(' ');

const nextConfig = {
    distDir: process.env['NEXT_DIST_DIR'] ?? '.next',
    // フレームワークのバージョン露出（X-Powered-By: Next.js）を抑止する
    poweredByHeader: false,
    reactStrictMode: true,
    // 管理画面は動的ルート（一覧→詳細・検索クエリ）が多いため typedRoutes は無効化する
    typedRoutes: false,
    typescript: {
        ignoreBuildErrors: false,
    },
    headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    { key: 'X-Frame-Options', value: 'DENY' },
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'Referrer-Policy', value: 'no-referrer' },
                    // 認証 Cookie は httpOnly でないため、HTTP への 1 リクエストで漏れないよう HTTPS を強制する
                    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
                    // 利用しないセンサー・デバイス API を明示的に無効化する
                    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
                    // 管理画面はインデックスさせない
                    { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
                    {
                        // base-uri: <base> 注入による相対 URL の乗っ取り防止 / object-src: プラグイン埋め込み禁止
                        key: 'Content-Security-Policy',
                        value: `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob: ${supabaseOrigin}; font-src 'self'; connect-src ${connectSrc}; frame-ancestors 'none'; base-uri 'self'; object-src 'none'`,
                    },
                ],
            },
        ];
    },
    transpilePackages: ['@repo/supabase', '@repo/ui'],
} as NextConfig;

export default nextConfig;
