import type { NextConfig } from 'next';

/**
 * Supabase クライアントは ブラウザから直接 REST / Realtime に接続するため、
 * connect-src に Supabase の origin（HTTP と WS の両方）を許可する必要がある。
 * 環境ごとに URL が変わるので NEXT_PUBLIC_SUPABASE_URL から導出する。
 */
const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : '';
const supabaseWsOrigin = supabaseOrigin.replace(/^http/, 'ws');
const connectSrc = ["'self'", supabaseOrigin, supabaseWsOrigin].filter(Boolean).join(' ');

// Supabase Storage の署名 URL を next/image で表示するためホストを許可する（012-photo-attachments）
const supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : '';

const nextConfig = {
    // Playwright の webServer（ホスト側）と Docker の dev サーバーが同じ .next を
    // 共有してキャッシュが破損する事故を防ぐため、ビルドディレクトリを上書き可能にする
    distDir: process.env['NEXT_DIST_DIR'] ?? '.next',
    // フレームワークのバージョン露出（X-Powered-By: Next.js）を抑止する
    poweredByHeader: false,
    reactStrictMode: true,
    typedRoutes: true,
    typescript: {
        ignoreBuildErrors: false,
    },
    images: {
        formats: ['image/avif', 'image/webp'],
        // Supabase Storage（署名 URL）のホストのみ許可する。URL は環境ごとに変わるため導出する
        remotePatterns: supabaseHostname
            ? [
                  {
                      protocol: supabaseOrigin.startsWith('https') ? 'https' : 'http',
                      hostname: supabaseHostname,
                      pathname: '/storage/v1/object/**',
                  },
              ]
            : [],
    },

    // セキュリティヘッダー
    headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    {
                        key: 'X-DNS-Prefetch-Control',
                        value: 'on',
                    },
                    {
                        // CSP の frame-ancestors 'none' と揃える（SAMEORIGIN との不一致を解消）
                        key: 'X-Frame-Options',
                        value: 'DENY',
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        // クロスオリジンへはオリジンのみ送り、HTTPS→HTTP のダウングレード時は送らない
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin',
                    },
                    {
                        // 認証 Cookie は httpOnly でないため、HTTP への 1 リクエストで漏れないよう HTTPS を強制する
                        key: 'Strict-Transport-Security',
                        value: 'max-age=63072000; includeSubDomains',
                    },
                    {
                        // 利用しないセンサー・デバイス API を明示的に無効化する
                        key: 'Permissions-Policy',
                        value: 'camera=(), microphone=(), geolocation=(), payment=()',
                    },
                    {
                        // base-uri: <base> 注入による相対 URL の乗っ取り防止 / object-src: プラグイン埋め込み禁止
                        key: 'Content-Security-Policy',
                        value: `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob: ${supabaseOrigin}; font-src 'self' https://fonts.gstatic.com; connect-src ${connectSrc}; frame-ancestors 'none'; base-uri 'self'; object-src 'none'`,
                    },
                ],
            },
        ];
    },

    transpilePackages: ['@repo/core', '@repo/supabase', '@repo/ui'],
} as NextConfig;

export default nextConfig;
