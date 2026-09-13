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

test('ダイブサイト詳細 - WCAG 2.1 AA 違反なし（要認証）', async ({ page }) => {
    // ログイン
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(TEST_EMAIL);
    await page.getByLabel('パスワード').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');

    // マスタ（seed の「大瀬崎」）を検索選択してログを作成
    await page.goto('/dives/new');
    await page.getByLabel(/潜水日/).fill('2026-04-15');
    const siteInput = page.getByRole('combobox', { name: /ダイブサイト/ });
    await siteInput.click();
    await siteInput.fill('大瀬');
    await page
        .getByRole('option', { name: /大瀬崎/ })
        .first()
        .click();
    await page.getByLabel(/最大水深/).fill('18');
    await page.getByLabel(/潜水時間/).fill('40');
    await page.getByRole('button', { name: '作成する' }).click();
    await page.waitForURL(/\/dives\/[0-9a-f-]+$/);

    // 詳細のサイト名リンク（h1 内）からダイブサイト詳細へ遷移し a11y を検証。
    // ヘッダー刷新後はパンくずの現在ページ（span[role="link"][aria-disabled]）が
    // /大瀬崎/ に部分一致してしまうため、見出しにスコープする
    await page
        .getByRole('heading', { level: 1 })
        .getByRole('link', { name: /大瀬崎/ })
        .click();
    await page.waitForURL(/\/dive-sites\/[0-9a-f-]+$/);
    await expectNoViolations(page);

    // 後始末: 作成したログを削除
    await page.goto('/dives');
    await page.getByRole('link').filter({ hasText: '大瀬崎' }).first().click();
    await page.waitForURL(/\/dives\/[0-9a-f-]+$/);
    await page.getByRole('button', { name: /削除/ }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: /削除/ }).click();
    await page.waitForURL(/\/dives$/);
});
