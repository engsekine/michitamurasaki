import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

import { presetConsent } from './_helpers';

/** a11y スイープでバナーが重ならないよう同意済み Cookie をプリセット（017-cookie-consent） */
test.beforeEach(async ({ context }) => {
    await presetConsent(context);
});

/** supabase/seed.sql のローカル開発専用テストユーザー */
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'password123';

/** seed の別ユーザー（プロフィール / フォロー UI の表示対象） */
const OTHER_USER_ID = '000000ad-0000-0000-0000-000000000001';

const login = async (page: Page) => {
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(TEST_EMAIL);
    await page.getByLabel('パスワード').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');
};

const expectNoViolations = async (page: Page) => {
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
};

/**
 * T051: ログフォームの DiveBuddyField（US1）と詳細の DiveVisibilityToggle（US2）の a11y。
 * 作成フォームでバディ行を追加した状態、および作成後の詳細で公開トグルを表示した状態の
 * いずれも WCAG 2.1 AA 違反がないことを確認する。
 */
test('ログ作成フォーム（バディ欄）・詳細（公開トグル）- WCAG 2.1 AA 違反なし（要認証）', async ({ page }) => {
    await login(page);

    // 作成フォーム: DiveBuddyField が描画され、バディ行を追加できる
    await page.goto('/dives/new');
    await expect(page.getByRole('group', { name: '同行したバディ' })).toBeVisible();
    await page.getByRole('button', { name: 'バディを追加' }).click();
    await expect(page.getByLabel('バディ名 1')).toBeVisible();
    await expectNoViolations(page);

    // バディ名を入力（空行はバリデーションで送信不可のため）
    await page.getByLabel('バディ名 1').fill('テストバディ');

    // ログを 1 件作成して詳細へ遷移（DiveVisibilityToggle = role="switch"）
    await page.getByLabel(/潜水日/).fill('2026-04-15');
    // ダイブ番号を明示指定して他テストとの一意制約衝突を避ける
    await page.getByLabel('ダイブ番号').fill('9201');
    await page.getByLabel(/ポイント名/).fill('a11y バディ・公開トグル検証');
    await page.getByLabel(/最大水深/).fill('18');
    await page.getByLabel(/潜水時間/).fill('40');
    await page.getByRole('button', { name: '作成する' }).click();
    await page.waitForURL(/\/dives\/[0-9a-f-]+$/);

    await expect(page.getByRole('switch', { name: 'このログを公開する' })).toBeVisible();
    await expectNoViolations(page);

    // 後始末: 作成したログを削除
    await page.getByRole('button', { name: /削除/ }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: /削除/ }).click();
    await page.waitForURL(/\/dives$/);
});

/**
 * T051: TOP タイムライン / 公開プロフィール（FollowButton・FollowCounts）/ フォロー一覧（FollowList）の a11y。
 * spec 021 US3/US4。空状態を含め WCAG 2.1 AA 違反がないことを確認する。
 */
test('タイムライン・プロフィール・フォロー一覧 - WCAG 2.1 AA 違反なし（要認証）', async ({ page }) => {
    await login(page);

    // TOP（タイムラインセクション）
    await page.goto('/');
    await expectNoViolations(page);

    // 公開プロフィール（FollowButton / FollowCounts）
    await page.goto(`/users/${OTHER_USER_ID}`);
    await expect(page.getByRole('button', { name: /^フォロー(中)?$/ })).toBeVisible();
    await expectNoViolations(page);

    // フォロー一覧（FollowList）
    await page.goto(`/users/${OTHER_USER_ID}/following`);
    await expectNoViolations(page);

    // フォロワー一覧（FollowList）
    await page.goto(`/users/${OTHER_USER_ID}/followers`);
    await expectNoViolations(page);

    // ユーザー検索（UserSearchBar + 検索結果の FollowList）。seed の admin がヒットする
    await page.goto('/users/search?q=admin');
    await expect(page.getByRole('searchbox', { name: 'ユーザーIDで探す' })).toBeVisible();
    await expectNoViolations(page);
});
