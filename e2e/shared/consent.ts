import type { BrowserContext } from '@playwright/test';

/**
 * Cookie 同意の保存先 Cookie 名（017-cookie-consent）。
 * E2E はアプリのソースを import しない（独立したワークスペース）ため値を再定義する。
 * 変更時は `service-front/src/features/consent/lib/cookie-consent.ts` の COOKIE_CONSENT_NAME と揃える。
 */
export const COOKIE_CONSENT_NAME = 'cookie-consent';

/**
 * a11y スイープ用に「同意済み」Cookie をプリセットする（017-cookie-consent）。
 * これにより既存ページの axe スキャンに Cookie 同意バナーが重ならず、決定的に検証できる。
 * バナー単体の a11y は専用の `cookie-consent.spec.ts` が担保する。
 */
export const presetConsent = async (context: BrowserContext): Promise<void> => {
    await context.addCookies([{ name: COOKIE_CONSENT_NAME, value: 'accepted', domain: 'localhost', path: '/' }]);
};
