/**
 * Cookie 同意の状態管理ユーティリティ（017-cookie-consent）。
 * 同意状態の参照はアプリ全体でここに一元化する（gating の単一参照点）。
 */

/** 同意状態 Cookie の名前 */
export const COOKIE_CONSENT_NAME = 'cookie-consent';

/** 同意の有効期限（約 12 か月）。期限切れ＝Cookie 消滅＝未選択で再表示 */
export const COOKIE_CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** 同意状態。未選択は null で表す */
export type ConsentState = 'accepted' | 'rejected';

/** `accepted` / `rejected` 以外（破損・改ざん・未設定）は null に正規化する */
const normalize = (value: string | undefined | null): ConsentState | null =>
    value === 'accepted' || value === 'rejected' ? value : null;

/**
 * サーバー（ルートレイアウト）が `cookies().get()` で得た値を正規化する純関数。
 * テスト容易性のため副作用を持たない。
 */
export const getCookieConsentServer = (cookieValue: string | undefined): ConsentState | null => normalize(cookieValue);

/** クライアントで `document.cookie` から同意状態を読む */
export const getCookieConsentClient = (): ConsentState | null => {
    if (typeof document === 'undefined') return null;
    const entry = document.cookie.split('; ').find((row) => row.startsWith(`${COOKIE_CONSENT_NAME}=`));
    return normalize(entry?.slice(`${COOKIE_CONSENT_NAME}=`.length));
};

/** 書き込む Cookie 文字列を組み立てる純関数（属性をテストできるよう分離） */
export const serializeConsentCookie = (state: ConsentState, isSecure: boolean): string => {
    const secure = isSecure ? '; Secure' : '';
    return `${COOKIE_CONSENT_NAME}=${state}; Max-Age=${COOKIE_CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
};

/** クライアントで同意状態を Cookie に書き込む */
export const setCookieConsent = (state: ConsentState): void => {
    if (typeof document === 'undefined') return;
    const isSecure = typeof location !== 'undefined' && location.protocol === 'https:';
    // biome-ignore lint/suspicious/noDocumentCookie: サーバー（ルートレイアウト）でも同じ Cookie を読む必要があり、同期的な document.cookie が要件。CookieStore API は非同期かつ SSR で使えない
    document.cookie = serializeConsentCookie(state, isSecure);
};
