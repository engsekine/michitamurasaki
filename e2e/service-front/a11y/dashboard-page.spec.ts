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

const expectNoViolations = async (page: Page) => {
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
};

test('TOP（ダッシュボード）- 累計ダイビング本数を含めて WCAG 2.1 AA 違反なし（要認証）', async ({ page }) => {
    // ログイン
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(TEST_EMAIL);
    await page.getByLabel('パスワード').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');

    // TOP（累計ダイビング本数セクションを含む）
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '累計ダイビング本数' })).toBeVisible();
    await expectNoViolations(page);

    // 代替データテーブル（details）を開いた状態でも違反がないこと（FR-009）
    const summaries = page.getByText('データを表で見る');
    const summaryCount = await summaries.count();
    for (let index = 0; index < summaryCount; index++) {
        await summaries.nth(index).click();
    }
    await expectNoViolations(page);
});
