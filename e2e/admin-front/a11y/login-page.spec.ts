import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * 管理画面ログインページの a11y 検証（015-admin-panel / WCAG 2.1 AA）。
 * 未認証でアクセスできる唯一のページ。フォームのラベル関連付け・エラー表示（role=alert）を含めて検査する。
 */
test('ログインページ - WCAG 2.1 AA 違反なし', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { level: 1, name: '運営管理画面ログイン' })).toBeVisible();

    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
});

test('ログインページ - バリデーションエラー表示状態でも WCAG 2.1 AA 違反なし', async ({ page }) => {
    await page.goto('/login');
    // 未入力で送信してフィールドエラーを表示させる（エラー文言と入力欄の関連付けを検査する）
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();
    await expect(page.getByText('メールアドレスを入力してください')).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
});
