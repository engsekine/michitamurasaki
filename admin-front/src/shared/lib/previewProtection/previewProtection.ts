import { type NextRequest, NextResponse } from 'next/server';

/**
 * Preview（stg）環境の保護。
 *
 * - Basic 認証: `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` が両方設定されているときだけ有効。
 *   Vercel の Preview スコープにのみ置く運用にすることで、prod・ローカルは未設定 = 無効になる。
 * - noindex: Vercel は `*.vercel.app` の Preview には `X-Robots-Tag: noindex` を自動付与するが、
 *   独自ドメインを Preview に割り当てると付与されないため、アプリ側でも保険として付ける。
 */

type Env = Readonly<Record<string, string | undefined>>;

export interface BasicAuthCredentials {
    user: string;
    password: string;
}

/** 環境変数から Basic 認証の資格情報を読む。どちらか一方でも無ければ null（= Basic 認証は無効） */
export const readBasicAuthCredentials = (env: Env = process.env): BasicAuthCredentials | null => {
    const user = env['BASIC_AUTH_USER'];
    const password = env['BASIC_AUTH_PASSWORD'];
    if (!user || !password) return null;
    return { user, password };
};

/** ブラウザが送る形式（`ID:パスワード` を UTF-8 で Base64 化）に合わせて期待値を組む */
const toBasicAuthorizationHeader = ({ user, password }: BasicAuthCredentials): string =>
    `Basic ${Buffer.from(`${user}:${password}`, 'utf8').toString('base64')}`;

/**
 * Basic 認証のゲート。通過なら null、拒否なら 401 レスポンスを返す。
 *
 * @param credentials - null なら認証しない（prod・ローカル）
 * @param excludedPathPrefixes - 認証を免除するパス（プレフィックス一致）。資格情報を付けられない
 *   サーバー間通信だけを列挙する
 */
export const requireBasicAuth = (
    request: NextRequest,
    credentials: BasicAuthCredentials | null,
    excludedPathPrefixes: readonly string[] = [],
): NextResponse | null => {
    if (!credentials) return null;

    const { pathname } = request.nextUrl;
    if (excludedPathPrefixes.some((prefix) => pathname.startsWith(prefix))) return null;

    if (request.headers.get('authorization') === toBasicAuthorizationHeader(credentials)) return null;

    return new NextResponse('Authentication required', {
        status: 401,
        headers: { 'WWW-Authenticate': 'Basic realm="staging", charset="UTF-8"' },
    });
};

/** Vercel 上の本番以外（preview / development）か。`VERCEL_ENV` はローカルでは未定義なので false */
export const isNonProductionVercelEnv = (env: Env = process.env): boolean => {
    const vercelEnv = env['VERCEL_ENV'];
    return vercelEnv !== undefined && vercelEnv !== 'production';
};

/** 検索エンジンにインデックスさせないヘッダーを付ける（渡したレスポンスを変更して返す） */
export const applyNoIndexHeader = (response: NextResponse): NextResponse => {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return response;
};
