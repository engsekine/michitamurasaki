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

test('/dives 系 2 画面 - WCAG 2.1 AA 違反なし（要認証）', async ({ page }) => {
    // ログイン
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(TEST_EMAIL);
    await page.getByLabel('パスワード').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');

    // 一覧（潮回りラベル付きカード）
    await page.goto('/dives');
    await expectNoViolations(page);

    // ログを 1 件作成して詳細（潮回りラベル込み）を検証
    await page.goto('/dives/new');
    await page.getByLabel(/潜水日/).fill('2026-04-15');
    await page.getByLabel(/ポイント名/).fill('a11y テスト用ポイント');
    await page.getByLabel(/最大水深/).fill('18');
    await page.getByLabel(/潜水時間/).fill('40');
    await page.getByRole('button', { name: '作成する' }).click();
    await page.waitForURL(/\/dives\/[0-9a-f-]+$/);
    await expectNoViolations(page);

    // 公開に切り替え、SNS 共有ボタン（spec 035）表示状態でも違反がないことを検証
    await page.getByRole('switch', { name: 'このログを公開する' }).click();
    await expect(page.getByRole('link', { name: 'X で共有' })).toBeVisible();
    await expectNoViolations(page);

    // 後始末: 作成したログを削除
    await page.getByRole('button', { name: /削除/ }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: /削除/ }).click();
    await page.waitForURL(/\/dives$/);
});

test('/dives 検索フィルタ詳細条件パネル展開時 - WCAG 2.1 AA 違反なし（要認証）', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(TEST_EMAIL);
    await page.getByLabel('パスワード').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');

    await page.goto('/dives');
    // 折りたたみ「詳細条件」を展開して期間・深度・ダイブタイプ入力を表示した状態を検証
    await page.getByRole('button', { name: '詳細条件を開く' }).click();
    await expect(page.getByLabel('開始日')).toBeVisible();
    await expect(page.getByLabel('ダイブタイプ')).toBeVisible();
    await expectNoViolations(page);
});
