import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

import { presetConsent } from './_helpers';

/**
 * ショップ画面（033-dive-shops）の a11y スイープ。
 * /shops・/shops/new は即スキャンし、/shops/[id]・/shops/[id]/edit は
 * テスト内で作成したショップを使ってスキャン後に削除する（seed 非依存・後始末込み）。
 */

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

test.beforeEach(async ({ context, page }) => {
    await presetConsent(context);
    await login(page);
});

test('/shops・/shops/new - WCAG 2.1 AA 違反なし', async ({ page }) => {
    await page.goto('/shops');
    await expectNoViolations(page);

    await page.goto('/shops/new');
    await expectNoViolations(page);
});

test('/shops/[id]・/shops/[id]/edit - WCAG 2.1 AA 違反なし（作成 → スキャン → 削除）', async ({ page }) => {
    // スキャン対象のショップを作成し URL から id を取得する
    await page.goto('/shops/new');
    const A11Y_SHOP_NAME = `a11y スキャン用ショップ_${Date.now()}`;
    await page.getByLabel(/ショップ名/).fill(A11Y_SHOP_NAME);
    await page.getByLabel(/電話番号/).fill('0120-000-000');
    await page.getByRole('button', { name: '登録する' }).click();
    await page.waitForURL(/\/shops\/[0-9a-f-]+$/);

    await expectNoViolations(page);

    // 編集画面
    await page.goto(`${page.url()}/edit`);
    await expectNoViolations(page);

    // 後始末: 削除して一覧に戻る
    await page.goto(page.url().replace(/\/edit$/, ''));
    await page.getByRole('button', { name: '削除', exact: true }).click();
    await page.getByRole('button', { name: '削除する' }).click();
    await page.waitForURL(/\/shops$/);
});

test('モバイル幅（375px）で /shops に横スクロールが発生しない', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/shops');
    await page.waitForLoadState('networkidle');

    const hasNoOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(hasNoOverflow).toBe(true);
});
