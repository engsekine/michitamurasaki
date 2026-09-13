import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

import { presetConsent } from './_helpers';

/**
 * NotificationBellPanel（ヘッダー通知ベル + Sheet）の a11y テスト。
 *
 * 既存の top-page.spec.ts / dashboard-page.spec.ts はベル閉状態のページスキャンのみであり、
 * Sheet を開いた状態（role="dialog" が DOM に展開された状態）は axe の解析対象外になる。
 * ここでは Sheet を明示的に開いた状態で axe スキャンを行う（前例: header-mobile-nav.spec.ts）。
 */

/** supabase/seed.sql のローカル開発専用テストユーザー */
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'password123';

test.beforeEach(async ({ context }) => {
    // Cookie 同意バナーが axe スキャンに干渉しないようプリセット（017-cookie-consent）
    await presetConsent(context);
});

/** ログインして TOP（/）へ遷移する共通ヘルパー */
const loginAndGoTop = async (page: Page) => {
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(TEST_EMAIL);
    await page.getByLabel('パスワード').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
};

test('NotificationBellPanel - Sheet 開状態 - WCAG 2.1 AA 違反なし（要認証）', async ({ page }) => {
    // seed.sql に通知データがない場合は「通知はありません」の空状態でスキャンされる
    await loginAndGoTop(page);

    // ベルボタンをクリックして Sheet（role="dialog"）を開く
    await page.getByRole('button', { name: /通知/ }).click();

    // SheetTitle と /notifications への導線が表示されるまで待機
    await expect(page.getByRole('dialog').getByRole('heading', { name: '通知' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'すべての通知を見る' })).toBeVisible();
    // Sheet の開きアニメーション（opacity 遷移）が終わる前に axe が走ると、
    // 半透明のコンテンツ越しにオーバーレイが透けた色でコントラストを誤検知するため収束を待つ
    await expect(page.locator('[data-slot="sheet-content"]')).toHaveCSS('opacity', '1');

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();

    expect(results.violations).toEqual([]);
});
