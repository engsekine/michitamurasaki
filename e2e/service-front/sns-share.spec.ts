import { expect, type Page, test } from '@playwright/test';

import { presetConsent } from './a11y/_helpers';

/**
 * spec 035（SNS 共有ボタン）の E2E 検証。
 * - US1: 公開ログ詳細で X / Facebook の共有ボタンが動作し、非公開では出ない
 * - US2: プロフィール（自分・他人）でプロフィール URL を共有できる
 * X / Facebook は外部サイトへ遷移するためクリックせず href を検証する。
 * Instagram は Web 共有インテント非対応のため提供しない（2026-07-16 改定）。
 */

/** supabase/seed.sql のローカル開発専用テストユーザー */
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'password123';

// ダイブ番号の一意制約衝突を避けるため直列実行する（番号は 92xx を使用し social-flows と重ねない）
test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ context }) => {
    await presetConsent(context);
});

const login = async (page: Page) => {
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(TEST_EMAIL);
    await page.getByLabel('パスワード').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');
};

/** X 共有アンカーの href から intent パラメータを取り出す */
const xIntentParams = async (page: Page) => {
    const href = (await page.getByRole('link', { name: 'X で共有' }).getAttribute('href')) ?? '';
    expect(href.startsWith('https://x.com/intent/post?')).toBe(true);
    return new URL(href).searchParams;
};

test('US1: 公開ログ詳細で SNS 共有ボタンが動作し、非公開では表示されない', async ({ page }) => {
    await login(page);

    // ログ作成（非公開のまま）
    await page.goto('/dives/new');
    await page.getByLabel(/潜水日/).fill('2026-04-21');
    await page.getByLabel('ダイブ番号').fill('9201');
    await page.getByLabel(/ポイント名/).fill('SNS共有の検証');
    await page.getByLabel(/最大水深/).fill('20');
    await page.getByLabel(/潜水時間/).fill('42');
    await page.getByRole('button', { name: '作成する' }).click();
    await page.waitForURL(/\/dives\/[0-9a-f-]+$/);
    const divePath = new URL(page.url()).pathname;

    // 非公開のうちは共有ボタンが無い（FR-001 / SC-003）
    await expect(page.getByRole('link', { name: 'X で共有' })).toHaveCount(0);

    // 公開に切り替えると X / Facebook の共有ボタンが表示される（Instagram は提供しない）
    await page.getByRole('switch', { name: 'このログを公開する' }).click();
    await expect(page.getByRole('link', { name: 'X で共有' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Facebook で共有' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Instagram/ })).toHaveCount(0);

    // X の intent URL に共有 URL（/dives/[id]）と定型テキストが入っている（FR-003/006/007）
    const params = await xIntentParams(page);
    expect(params.get('url')).toMatch(new RegExp(`${divePath}$`));
    expect(params.get('text')).toContain('SNS共有の検証のダイビングログ');

    // Facebook は sharer.php に URL のみ渡す（FR-004）
    const fbHref = (await page.getByRole('link', { name: 'Facebook で共有' }).getAttribute('href')) ?? '';
    expect(fbHref.startsWith('https://www.facebook.com/sharer/sharer.php?')).toBe(true);
    expect(new URL(fbHref).searchParams.get('u')).toMatch(new RegExp(`${divePath}$`));

    // 非公開に戻すと共有ボタンが消える
    await page.getByRole('switch', { name: 'このログを公開する' }).click();
    await expect(page.getByText('非公開')).toBeVisible();
    await expect(page.getByRole('link', { name: 'X で共有' })).toHaveCount(0);

    // 後始末: 作成したログを削除
    await page.getByRole('button', { name: /削除/ }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: /削除/ }).click();
    await page.waitForURL(/\/dives$/);
});

test('US2: 自分・他人のプロフィールで SNS 共有ボタンが表示されプロフィール URL を共有できる', async ({ page }) => {
    await login(page);

    // 自分のプロフィール（seed の test@example.com は handle: taro）
    await page.goto('/users/taro');
    await expect(page.getByRole('link', { name: 'X で共有' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Facebook で共有' })).toBeVisible();

    const selfParams = await xIntentParams(page);
    expect(selfParams.get('url')).toMatch(/\/users\/taro$/);
    expect(selfParams.get('text')).toContain('のダイビングプロフィール');

    // 他人のプロフィール（seed の buddy@example.com は handle: buddy-taro）でも共有できる
    await page.goto('/users/buddy-taro');
    await expect(page.getByRole('link', { name: 'X で共有' })).toBeVisible();
    const otherParams = await xIntentParams(page);
    expect(otherParams.get('url')).toMatch(/\/users\/buddy-taro$/);
});
