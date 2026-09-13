import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

import { presetConsent } from './_helpers';

/** a11y スイープでバナーが重ならないよう同意済み Cookie をプリセット（017-cookie-consent） */
test.beforeEach(async ({ context }) => {
    await presetConsent(context);
});

/** supabase/seed.sql のローカル開発専用テストユーザー */
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'password123';

const login = async (page: Page) => {
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(TEST_EMAIL);
    await page.getByLabel('パスワード').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');
};

const expectNoViolations = async (page: Page) => {
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
};

/**
 * TimelineTabsSwitcher の各タブパネルが axe の解析対象になる状態（hidden なし）での WCAG 2.1 AA 違反を検証する。
 * top-page.spec.ts / social-pages.spec.ts は初期タブ（「タイムライン」）でのみスキャンするため、
 * hidden 属性で隠れた「いいねしたログ」パネルは axe の対象外になる。ここでは各タブを visible にして検証する。
 */
test('TimelineTabsSwitcher - 「いいねしたログ」タブ表示時 - WCAG 2.1 AA 違反なし（要認証）', async ({ page }) => {
    await login(page);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 「いいねしたログ」タブに切り替えてパネルを visible にしてからスキャン
    await page.getByRole('tab', { name: 'いいねしたログ' }).click();
    await expect(page.getByRole('tab', { name: 'いいねしたログ' })).toHaveAttribute('aria-selected', 'true');
    await expectNoViolations(page);
});
