import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

import { presetConsent } from './_helpers';

/**
 * spec 026 のログ枠 UI の a11y + 表示検証。
 * - /settings/log-credits（購入カード・履歴・決済結果通知）
 * - ログ一覧 / 新規作成の残枠バッジ（FR-013）
 * 購入完了・返金は Stripe CLI が必要なため quickstart 3・4 の手動検証に委ねる。
 */

/** a11y スイープでバナーが重ならないよう同意済み Cookie をプリセット（017-cookie-consent） */
test.beforeEach(async ({ context }) => {
    await presetConsent(context);
});

/** supabase/seed.sql のローカル開発専用テストユーザー */
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'password123';

const expectNoViolations = async (page: Page) => {
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
};

const login = async (page: Page) => {
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(TEST_EMAIL);
    await page.getByLabel('パスワード').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');
};

test('/settings/log-credits - 購入カードと残枠を表示し WCAG 2.1 AA 違反なし（要認証）', async ({ page }) => {
    await login(page);

    await page.goto('/settings/log-credits');
    await expect(page.getByRole('heading', { name: 'ログ枠の購入' })).toBeVisible();
    await expect(page.getByText('残りログ枠')).toBeVisible();
    // 3 パック（お試し / おすすめ / たっぷり）それぞれに購入ボタンが表示される
    await expect(page.getByRole('heading', { name: 'お試しパック（10 枠）' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'おすすめパック（30 枠）' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'たっぷりパック（100 枠）' })).toBeVisible();
    await expect(page.getByRole('button', { name: '購入する' })).toHaveCount(3);
    await expect(page.getByRole('heading', { name: '購入履歴' })).toBeVisible();
    await expectNoViolations(page);

    // 決済キャンセルで戻ったときの通知（checkout=cancelled）
    await page.goto('/settings/log-credits?checkout=cancelled');
    await expect(page.getByText('購入はキャンセルされました。')).toBeVisible();
    await expectNoViolations(page);

    // 決済成功で戻ったときの通知（webhook 反映前の案内 + ログ作成への復帰導線 / US2-AC4）
    await page.goto('/settings/log-credits?checkout=success');
    await expect(page.getByText('ご購入ありがとうございます')).toBeVisible();
    await expect(page.getByRole('link', { name: 'ログ作成に戻る' })).toBeVisible();
    await expectNoViolations(page);
});

test('ログ一覧・新規作成に残枠バッジが表示される（FR-013）', async ({ page }) => {
    await login(page);

    await page.goto('/dives');
    await expect(page.getByText('残りログ枠')).toBeVisible();

    await page.goto('/dives/new');
    await expect(page.getByText('残りログ枠')).toBeVisible();
    await expectNoViolations(page);
});
