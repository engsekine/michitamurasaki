import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

import { presetConsent } from './_helpers';

/** コピー機能（navigator.clipboard.writeText）の検証に clipboard-write 権限が必要 */
test.use({ permissions: ['clipboard-write'] });

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

const login = async (page: Page) => {
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(TEST_EMAIL);
    await page.getByLabel('パスワード').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');
};

test('/application-sheet - WCAG 2.1 AA 違反なし（要認証）', async ({ page }) => {
    await login(page);

    await page.goto('/application-sheet');
    await expect(page.getByRole('heading', { name: '申し込みシート', level: 1 })).toBeVisible();
    await expectNoViolations(page);

    // レンタル「有」で品目 14 種のチェックボックスを展開した状態でも違反がないこと
    await page.getByRole('group', { name: 'レンタル器材の有無' }).getByLabel('有').check();
    await expect(page.getByLabel('ウエットスーツフルセット')).toBeVisible();
    await expectNoViolations(page);

    // レンタル「無」で省略トグルを表示した状態でも違反がないこと（FR-011 / FR-012）
    await page.getByRole('group', { name: 'レンタル器材の有無' }).getByLabel('無').check();
    await expect(page.getByLabel(/未該当ブロックを省略する/)).toBeVisible();
    await expectNoViolations(page);
});

test('/application-sheet - キーボード操作で入力とコピーができる（要認証）', async ({ page }) => {
    await login(page);

    await page.goto('/application-sheet');

    // キーボードのみで入力できる（label 関連付け + フォーカス移動）。
    // お名前はプロフィールから自動入力されるため、いったん空にしてから打ち直す（FR-008 の上書きも兼ねる）
    await page.getByLabel('お名前').fill('');
    await page.getByLabel('お名前').click();
    await page.keyboard.type('山田 太郎');
    await expect(page.getByLabel('生成テキスト')).toHaveValue(/・お名前（山田 太郎）/);

    // Tab / Space でラジオを操作できる（ネイティブ要素）
    const drySuitYes = page.getByRole('group', { name: 'ドライスーツの経験' }).getByLabel('有');
    await drySuitYes.focus();
    await page.keyboard.press('Space');
    await expect(page.getByLabel('生成テキスト')).toHaveValue(/・ドライスーツの経験（有）/);

    // Enter でコピーが実行され role="status" の完了通知が出る（FR-006）
    await page.getByRole('button', { name: 'コピーする' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status').filter({ hasText: 'コピーしました' })).toBeVisible();
});
