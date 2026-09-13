import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { NO_AUTH } from '../../shared/auth';

/** このファイルは未認証状態から始める（project 既定のログイン済み storageState を打ち消す） */
test.use({ storageState: NO_AUTH });

/**
 * Cookie 同意バナー表示状態の a11y（017-cookie-consent / SC-005）。
 * 同意 Cookie 未設定でトップを開くとバナーが出るので、その状態で WCAG 2.1 AA を検証する。
 */
test('Cookie 同意バナー表示時 - WCAG 2.1 AA 違反なし', async ({ context, page }) => {
    await context.clearCookies();
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // バナーが表示されていることを確認
    await expect(page.getByRole('region', { name: 'Cookie の利用について' })).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();

    expect(results.violations).toEqual([]);
});
