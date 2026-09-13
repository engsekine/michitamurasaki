import { expect, type Page, test } from '@playwright/test';

/** supabase/seed.sql のローカル開発専用テストユーザー */
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'password123';

const BANNER = { name: 'Cookie の利用について' } as const;

const login = async (page: Page) => {
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(TEST_EMAIL);
    await page.getByLabel('パスワード').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');
};

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
    await login(page);
    await context.clearCookies(); // セッションも消えるため再ログイン
    await login(page);

    await page.goto('/dives');
    await expect(page.getByRole('region', BANNER)).toBeVisible();
    await page.getByRole('button', { name: '同意する' }).click();
    await expect(page.getByRole('region', BANNER)).toBeHidden();
});

// US2 (FR-008 / G2): 拒否しても必須＝認証セッションは維持される
test('バナーで拒否しても認証セッションが維持され /dives にアクセスできる', async ({ page }) => {
    await login(page);
    await page.goto('/dives');
    await page.getByRole('button', { name: '拒否する' }).click();

    await page.goto('/dives');
    await expect(page).toHaveURL(/\/dives/); // /login にリダイレクトされない＝セッション維持
});
