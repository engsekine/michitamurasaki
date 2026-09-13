import { expect, test } from '@playwright/test';

import { loginWithPassword, NO_AUTH } from '../shared/auth';
import { ADMIN_USER } from '../shared/users';

/** このファイルは未認証状態から始める（project 既定のログイン済み storageState を打ち消す） */
test.use({ storageState: NO_AUTH });

/**
 * 管理画面（admin-front）の認証境界のスモークテスト（015-admin-panel / contracts/admin-auth.md）。
 * - 未認証は proxy で /login に遮断される
 * - 誤った資格情報ではセッションを作らない
 * - seed の superadmin でログインするとダッシュボードに入れる
 */

test('未認証で保護ページ（/）を開くとログインへリダイレクトされる', async ({ page }) => {
    await page.goto('/');

    await page.waitForURL(/\/login$/);
    await expect(page.getByRole('heading', { name: '運営管理画面ログイン' })).toBeVisible();
});

test('誤ったパスワードではエラーを表示し、ログインページに留まる', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(ADMIN_USER.email);
    await page.getByLabel('パスワード').fill('wrong-password');
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();

    // Next.js のルートアナウンサー（role=alert）と区別するためテキストで絞る
    await expect(
        page.getByRole('alert').filter({ hasText: 'メールアドレスまたはパスワードが間違っています' }),
    ).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/login');
});

test('seed の上位管理者でログインするとダッシュボードが表示される', async ({ page }) => {
    await loginWithPassword(page, ADMIN_USER);

    await expect(page.getByRole('heading', { name: 'ダッシュボード' })).toBeVisible();
});
