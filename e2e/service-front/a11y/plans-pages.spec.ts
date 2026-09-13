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

test('/plans 系 3 画面 - WCAG 2.1 AA 違反なし（要認証）', async ({ page }) => {
    // ログイン
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(TEST_EMAIL);
    await page.getByLabel('パスワード').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');

    // 一覧
    await page.goto('/plans');
    await expectNoViolations(page);

    // 作成フォーム
    await page.goto('/plans/new');
    await expectNoViolations(page);

    // 予定を 1 件作成して詳細（持ち物リスト）を検証
    await page.getByLabel(/予定日/).fill('2026-12-01');
    await page.getByLabel(/ポイント名/).fill('a11y テスト用ポイント');
    await page.getByRole('button', { name: '作成する' }).click();
    await page.waitForURL(/\/plans\/[0-9a-f-]+$/);
    await expectNoViolations(page);

    // 後始末: 作成した予定を削除（持ち物は cascade で消える）
    await page.getByRole('button', { name: /削除/ }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: /削除/ }).click();
    await page.waitForURL(/\/plans$/);
});
