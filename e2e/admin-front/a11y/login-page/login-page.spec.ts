import { expectNoViolations } from '../../../shared/a11y';
import { NO_AUTH } from '../../../shared/auth';
import { expect, test } from '../../../shared/test';

/** Cookie 同意バナーの有無を含めて検証するため、fixture 既定の同意済みプリセットを打ち消す */
test.use({ cookieConsent: 'unset' });

/** このファイルは未認証状態から始める（project 既定のログイン済み storageState を打ち消す） */
test.use({ storageState: NO_AUTH });

/**
 * 管理画面ログインページの a11y 検証（015-admin-panel / WCAG 2.1 AA）。
 * 未認証でアクセスできる唯一のページ。フォームのラベル関連付け・エラー表示（role=alert）を含めて検査する。
 */
test('ログインページ - WCAG 2.1 AA 違反なし', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { level: 1, name: '運営管理画面ログイン' })).toBeVisible();

    await page.waitForLoadState('networkidle');
    await expectNoViolations(page);
});

test('ログインページ - バリデーションエラー表示状態でも WCAG 2.1 AA 違反なし', async ({ page }) => {
    await page.goto('/login');
    // 未入力で送信してフィールドエラーを表示させる（エラー文言と入力欄の関連付けを検査する）
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();
    await expect(page.getByText('メールアドレスを入力してください')).toBeVisible();

    await expectNoViolations(page);
});
