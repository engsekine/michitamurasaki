import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { presetConsent } from './_helpers';

/** a11y スイープでバナーが重ならないよう同意済み Cookie をプリセット（017-cookie-consent） */
test.beforeEach(async ({ context }) => {
    await presetConsent(context);
});

/** supabase/seed.sql のローカル開発専用テストユーザー */
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'password123';

/**
 * 使い方ページ（030-usage-guide）の a11y / 公開性検証。
 * 公開ページのため未ログイン（クリーンな context）でアクセスする。
 */
test('使い方ページ - 未ログインでリダイレクトされず表示され WCAG 2.1 AA 違反なし', async ({ page }) => {
    await page.goto('/guide');

    // 認証ガードの対象外（FR-001）: ログイン画面へリダイレクトされない
    await expect(page).toHaveURL(/\/guide$/);
    await expect(page.getByRole('heading', { level: 1, name: '使い方' })).toBeVisible();

    // 6 セクションがすべて表示される（FR-002）
    for (const title of [
        'はじめに',
        'ダイブログを記録する',
        'ダイビング予定と持ち物リスト',
        'ダッシュボードで振り返る',
        'みんなのログ・いいね',
        'ログ枠と追加購入',
    ]) {
        await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible();
    }

    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
});

test('使い方ページ - robots メタに noindex が含まれない（FR-010）', async ({ page }) => {
    await page.goto('/guide');

    const robots = page.locator('meta[name="robots"]');
    await expect(robots).toHaveCount(1);
    await expect(robots).not.toHaveAttribute('content', /noindex/);
});

test('使い方ページ - 登録導線から新規登録画面へ遷移できる（FR-005）', async ({ page }) => {
    await page.goto('/guide');

    // ページ末尾の登録 CTA（未ログイン閲覧者向け）
    await page.getByRole('link', { name: '無料で始める' }).click();
    await expect(page).toHaveURL(/\/signup$/);
});

test('使い方ページ - ログイン済みでも同一コンテンツが表示される（FR-001）', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(TEST_EMAIL);
    await page.getByLabel('パスワード').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');

    await page.goto('/guide');
    await expect(page).toHaveURL(/\/guide$/);
    await expect(page.getByRole('heading', { level: 1, name: '使い方' })).toBeVisible();
});

test('使い方ページ - モバイル幅（375px）で横スクロールが発生しない（SC-004）', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/guide');
    await page.waitForLoadState('networkidle');

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
});

test('使い方ページ - 目次から各セクションへ移動し、目次に戻れる（FR-003）', async ({ page }) => {
    await page.goto('/guide');

    // 目次のアンカーで該当セクションへ移動する
    const toc = page.getByRole('navigation', { name: '目次' });
    await toc.getByRole('link', { name: 'ダッシュボードで振り返る' }).click();
    await expect(page).toHaveURL(/#dashboard$/);
    await expect(page.getByRole('heading', { level: 2, name: 'ダッシュボードで振り返る' })).toBeInViewport();

    // キーボード操作（Enter）で「目次に戻る」を発火できる
    const backLink = page.getByRole('link', { name: '目次に戻る' }).first();
    await backLink.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#guide-toc$/);
    await expect(toc).toBeInViewport();
});
