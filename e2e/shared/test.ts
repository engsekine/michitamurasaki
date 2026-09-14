import { test as base } from '@playwright/test';

import { presetConsent } from './consent';

/**
 * E2E 共通の fixture 入り `test`。各 spec は `@playwright/test` ではなくここから import する。
 *
 * なぜ: 25 本の spec が同じ `beforeEach` で Cookie 同意をプリセットしていた。
 * 既定コンテキストの準備は fixture に寄せ、spec 本体にはシナリオだけを残す。
 * どうやるか: `context` fixture を上書きし、生成直後に同意済み Cookie を入れる。
 * バナーの表示自体を検証する spec は `test.use({ cookieConsent: 'unset' })` で打ち消す。
 * `browser.newContext()` で自前に作るコンテキストは対象外なので、必要なら `presetConsent` を直接呼ぶ。
 */

/** 既定コンテキストの Cookie 同意状態。`accepted` = 同意済み Cookie をプリセット（既定）、`unset` = 何も入れない */
export type CookieConsent = 'accepted' | 'unset';

interface E2eOptions {
    cookieConsent: CookieConsent;
}

export const test = base.extend<E2eOptions>({
    cookieConsent: ['accepted', { option: true }],
    context: async ({ context, cookieConsent }, use) => {
        if (cookieConsent === 'accepted') await presetConsent(context);
        await use(context);
    },
});

export type { BrowserContext, Locator, Page } from '@playwright/test';
export { expect } from '@playwright/test';
