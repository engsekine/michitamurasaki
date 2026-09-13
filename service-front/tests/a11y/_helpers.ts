import type { BrowserContext } from '@playwright/test';

import { COOKIE_CONSENT_NAME } from '../../src/features/consent/lib/cookie-consent';

/**
 * a11y スイープ用に「同意済み」Cookie をプリセットする（017-cookie-consent）。
 * これにより既存ページの axe スキャンに Cookie 同意バナーが重ならず、決定的に検証できる。
 * バナー単体の a11y は専用の `cookie-consent.spec.ts` が担保する。
 */
export const presetConsent = async (context: BrowserContext): Promise<void> => {
    await context.addCookies([{ name: COOKIE_CONSENT_NAME, value: 'accepted', domain: 'localhost', path: '/' }]);
};
