import { expect, test } from '@playwright/test';
import { loginWithPassword, NO_AUTH } from '../shared/auth';
import { SERVICE_USER } from '../shared/users';

/** このファイルは未認証状態から始める（project 既定のログイン済み storageState を打ち消す） */
test.use({ storageState: NO_AUTH });

const BANNER = { name: 'Cookie の利用について' } as const;

test.beforeEach(async ({ context }) => {
    await context.clearCookies();
});

// US1 / US2: 初回表示 → 同意 → リロードで再表示しない（quickstart シナリオ A）
test('未選択でバナー表示 → 同意 → リロードで再表示されない', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('region', BANNER)).toBeVisible();

    await page.getByRole('button', { name: '同意する' }).click();
    await expect(page.getByRole('region', BANNER)).toBeHidden();

    await page.reload();
    await expect(page.getByRole('region', BANNER)).toBeHidden();
});

// US1: 拒否（quickstart シナリオ B）
test('拒否すると記録されバナーが閉じる', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '拒否する' }).click();
    await expect(page.getByRole('region', BANNER)).toBeHidden();
    await page.reload();
    await expect(page.getByRole('region', BANNER)).toBeHidden();
});

// US2: 期限切れ相当（Cookie 削除）で再表示（quickstart シナリオ E / FR-005）
test('同意 Cookie を削除すると再びバナーが表示される', async ({ page, context }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '同意する' }).click();
    await expect(page.getByRole('region', BANNER)).toBeHidden();

    await context.clearCookies();
    await page.goto('/');
    await expect(page.getByRole('region', BANNER)).toBeVisible();
});

// US4: フッター「Cookie 設定」から再表示（quickstart シナリオ D / FR-009）
test('選択済みでもフッターの「Cookie 設定」でバナーを再表示できる', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '同意する' }).click();
    await expect(page.getByRole('region', BANNER)).toBeHidden();

    await page.getByRole('button', { name: 'Cookie 設定' }).click();
    await expect(page.getByRole('region', BANNER)).toBeVisible();
});

// US1 (FR-010 / G1): ログイン済みでもバナーが機能する
test('ログイン済み状態でも未選択ならバナーが表示され同意できる', async ({ page, context }) => {
    await loginWithPassword(page, SERVICE_USER);
    await context.clearCookies(); // セッションも消えるため再ログイン
    await loginWithPassword(page, SERVICE_USER);

    await page.goto('/dives');
    await expect(page.getByRole('region', BANNER)).toBeVisible();
    await page.getByRole('button', { name: '同意する' }).click();
    await expect(page.getByRole('region', BANNER)).toBeHidden();
});

// US2 (FR-008 / G2): 拒否しても必須＝認証セッションは維持される
test('バナーで拒否しても認証セッションが維持され /dives にアクセスできる', async ({ page }) => {
    await loginWithPassword(page, SERVICE_USER);
    await page.goto('/dives');
    await page.getByRole('button', { name: '拒否する' }).click();

    await page.goto('/dives');
    await expect(page).toHaveURL(/\/dives/); // /login にリダイレクトされない＝セッション維持
});
