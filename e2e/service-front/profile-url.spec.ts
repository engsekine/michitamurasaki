import { expect, type Page, test } from '@playwright/test';

import { presetConsent } from './a11y/_helpers';

/**
 * ユーザー ID とプロフィール URL（034 Rev.2）の E2E 検証。quickstart.md のシナリオに対応する。
 * - シナリオ 2: ユーザー ID の URL・大文字解決・導線・uuid 転送・404
 * - シナリオ 3: ユーザー ID の変更と URL の追随（リネーム専用ユーザーで実施）
 * 登録フォームの形式・重複エラー（シナリオ 1）は schema / form の単体テストで担保する。
 */

/** supabase/seed.sql のローカル開発専用テストユーザー（handle: taro / nickname: たろう） */
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'password123';
/** 2 人目のテストユーザー（固定 uuid / handle: buddy-taro） */
const BUDDY_ID = '000000bd-0000-0000-0000-000000000002';
const BUDDY_HANDLE = 'buddy-taro';

const login = async (page: Page) => {
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(TEST_EMAIL);
    await page.getByLabel('パスワード').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');
};

test.beforeEach(async ({ context, page }) => {
    await presetConsent(context);
    await login(page);
});

test('ユーザー ID の URL でプロフィールが表示される（表示名はニックネームのまま）', async ({ page }) => {
    await page.goto(`/users/${BUDDY_HANDLE}`);
    // 表示名（見出し）はニックネーム（FR-010）
    await expect(page.getByRole('heading', { name: 'buddy-taro' })).toBeVisible();
});

test('ヘッダーのマイプロフィールからユーザー ID の URL で遷移する', async ({ page }) => {
    await page.getByRole('button', { name: 'アカウントメニューを開く' }).click();
    await page.getByRole('link', { name: /マイプロフィール/ }).click();

    // metadata の handle からユーザー ID の URL が生成される（FR-004）
    await page.waitForURL((url) => url.pathname === '/users/taro');
    await expect(page.getByRole('heading', { name: 'たろう' })).toBeVisible();
});

test('followers / following もユーザー ID 基準の URL で表示される', async ({ page }) => {
    await page.goto(`/users/${BUDDY_HANDLE}/followers`);
    await expect(page.getByRole('heading', { name: /さんのフォロワー/ })).toBeVisible();

    await page.goto(`/users/${BUDDY_HANDLE}/following`);
    await expect(page.getByRole('heading', { name: /さんのフォロー中/ })).toBeVisible();
});

test('大文字だけが異なる URL は同一ユーザーに解決される（FR-002）', async ({ page }) => {
    await page.goto(`/users/${BUDDY_HANDLE.toUpperCase()}`);
    await expect(page.getByRole('heading', { name: 'buddy-taro' })).toBeVisible();
});

test('存在しないユーザー ID・uuid の URL は 404 になる（FR-007）', async ({ page }) => {
    const byHandle = await page.goto('/users/no-such-user-xyz');
    expect(byHandle?.status()).toBe(404);
    await expect(page.getByText('お探しのページが見つかりませんでした')).toBeVisible();

    const byUuid = await page.goto('/users/00000000-0000-0000-0000-00000000dead');
    expect(byUuid?.status()).toBe(404);
});

test('内部 ID（uuid）形式の URL はユーザー ID の URL へ転送される（FR-005）', async ({ page }) => {
    await page.goto(`/users/${BUDDY_ID}`);
    await page.waitForURL((url) => url.pathname === `/users/${BUDDY_HANDLE}`);
    await expect(page.getByRole('heading', { name: 'buddy-taro' })).toBeVisible();

    // 下層パス（followers）も維持して転送される
    await page.goto(`/users/${BUDDY_ID}/followers`);
    await page.waitForURL((url) => url.pathname === `/users/${BUDDY_HANDLE}/followers`);
});

// シナリオ 3: ユーザー ID の変更（US3）。
// 並列実行中の他テスト（buddy-taro 依存）と干渉しないよう、リネーム専用ユーザーで実施し最後に戻す
const RENAME_EMAIL = 'rename@example.com';
const RENAME_ID = '000000ce-0000-0000-0000-000000000003';
const RENAME_HANDLE = 'rename-saburo';

const changeHandle = async (page: Page, handle: string) => {
    await page.goto('/settings/profile');
    const input = page.getByLabel('ユーザー ID');
    // 前回実行の中断で既に目的の値になっている場合は送信しない
    // （同値のままでは「更新する」が disabled でクリックできず、再実行不能になるため）
    if ((await input.inputValue()) === handle) return;
    await input.fill(handle);
    await page.getByRole('button', { name: '更新する' }).click();
    await expect(page.getByText('プロフィールを更新しました')).toBeVisible({ timeout: 15_000 });
};

test('ユーザー ID の変更で URL が追随し、旧 ID は無効・uuid URL は転送される（US3）', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await presetConsent(context);
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(RENAME_EMAIL);
    await page.getByLabel('パスワード').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');

    const NEW_HANDLE = 'rename-shiro';
    await changeHandle(page, NEW_HANDLE);

    try {
        // 新しいユーザー ID の URL で表示できる（SC-004）
        await page.goto(`/users/${NEW_HANDLE}`);
        await expect(page.getByRole('heading', { name: 'rename-saburo' })).toBeVisible();

        // 旧ユーザー ID の URL は 404（FR-006）
        const oldResponse = await page.goto(`/users/${RENAME_HANDLE}`);
        expect(oldResponse?.status()).toBe(404);

        // uuid 形式 URL は新しいユーザー ID の URL へ転送される（uuid 経由は変更に影響されない）
        await page.goto(`/users/${RENAME_ID}`);
        await page.waitForURL((url) => url.pathname === `/users/${NEW_HANDLE}`);

        // ヘッダーのマイプロフィールも新ユーザー ID の URL になる（metadata 同期）
        await page.goto('/');
        await page.getByRole('button', { name: 'アカウントメニューを開く' }).click();
        await expect(page.getByRole('link', { name: /マイプロフィール/ })).toHaveAttribute(
            'href',
            `/users/${NEW_HANDLE}`,
        );
    } finally {
        // 後始末: ユーザー ID を元に戻す
        await changeHandle(page, RENAME_HANDLE);
        await context.close();
    }
});

test('不正な形式・予約語への変更は拒否される（FR-002・003）', async ({ page }) => {
    await page.goto('/settings/profile');

    await page.getByLabel('ユーザー ID').fill('a/b');
    await page.getByRole('button', { name: '更新する' }).click();
    await expect(
        page.getByText('ユーザー ID は半角英小文字・数字・ - _ の 3〜30 文字（先頭は英字）で入力してください'),
    ).toBeVisible();

    await page.getByLabel('ユーザー ID').fill('search');
    await page.getByRole('button', { name: '更新する' }).click();
    await expect(page.getByText('このユーザー ID は使用できません')).toBeVisible();

    await page.getByLabel('ユーザー ID').fill(BUDDY_HANDLE); // 他人の ID
    await page.getByRole('button', { name: '更新する' }).click();
    await expect(page.getByText('このユーザー ID は既に使われています。別のユーザー ID をお試しください')).toBeVisible({
        timeout: 15_000,
    });
});
