import type { Page } from '@playwright/test';

/**
 * supabase/seed.sql.template が投入するローカル開発専用の上位管理者（superadmin）。
 * 値はテンプレートに直書きされている（envsubst の対象外）ため、変更時は両方を揃える。
 */
export const ADMIN_EMAIL = 'admin@example.com';
export const ADMIN_PASSWORD = 'admin-password';

/** 管理画面にメール / パスワードでログインし、ダッシュボード（`/`）に到達するまで待つ */
export const loginAsAdmin = async (page: Page): Promise<void> => {
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(ADMIN_EMAIL);
    await page.getByLabel('パスワード').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');
};
