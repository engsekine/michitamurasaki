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

const signIn = async (page: Page) => {
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(TEST_EMAIL);
    await page.getByLabel('パスワード').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');
};

test('通知一覧 - WCAG 2.1 AA 違反なし（要認証 / 025）', async ({ page }) => {
    await signIn(page);

    // ヘッダーの通知アイコンから遷移できる（FR-004）。
    // ヘッダー刷新で通知アイコンは直接リンクからベルパネル（Sheet）を開くボタンに変わったため、
    // パネル内の「すべての通知を見る」経由で /notifications へ遷移する
    await page.getByRole('button', { name: /^通知/ }).click();
    await page.getByRole('link', { name: 'すべての通知を見る' }).click();
    await page.waitForURL(/\/notifications/);
    await expect(page.getByRole('heading', { name: '通知', exact: true })).toBeVisible();
    await expectNoViolations(page);
});

test('通知設定 - WCAG 2.1 AA 違反なし（要認証 / 025）', async ({ page }) => {
    await signIn(page);

    await page.goto('/settings/notifications');
    await expect(page.getByRole('heading', { name: '通知設定' })).toBeVisible();
    // 5 種別のトグルが存在する（025 FR-011 の 4 種別 + 027 で追加された log_liked。NOTIFICATION_TYPES と同数）
    await expect(page.getByRole('switch')).toHaveCount(5);
    await expectNoViolations(page);
});
