import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

import { presetConsent } from './a11y/_helpers';

/**
 * ランディングページ（031）の E2E 検証。quickstart.md のシナリオに対応する。
 * - US1: 未認証で /lp が表示され、CTA から /signup へ進める
 * - US2: LP 追加後も既存挙動（/ の未認証リダイレクト・認証済み表示）が不変
 * - US3: metadata / sitemap / モバイル表示
 * a11y（axe）の全ページスイープは tests/a11y/public-pages.spec.ts が /lp も含めて担保するが、
 * SC-006 のトレーサビリティのため本ファイルでも /lp 単体の axe スキャンを持つ。
 */

/** supabase/seed.sql のローカル開発専用テストユーザー */
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'password123';

const login = async (page: Page) => {
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(TEST_EMAIL);
    await page.getByLabel('パスワード').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();
    // ログイン後の遷移先は TOP ダッシュボード（/）。/dives だった頃の前提を更新
    await page.waitForURL((url) => url.pathname === '/');
};

test.beforeEach(async ({ context }) => {
    await presetConsent(context);
});

// US1: 未認証で LP が表示され、構成と登録導線が揃っている（FR-001 / FR-003）
test('未認証で /lp が表示され、CTA から /signup へ遷移できる', async ({ page }) => {
    const response = await page.goto('/lp');
    expect(response?.status()).toBe(200);
    // ログイン画面へリダイレクトされない
    await expect(page).toHaveURL(/\/lp$/);

    // ページ内の h1 は 1 つだけ（見出し階層）
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

    // 主要 CTA（ヒーロー・最下部）はいずれも /signup を指す
    const ctas = page.getByRole('link', { name: '無料ではじめる' });
    expect(await ctas.count()).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < (await ctas.count()); i++) {
        await expect(ctas.nth(i)).toHaveAttribute('href', '/signup');
    }

    // ログイン導線がある（FR-007）
    await expect(page.getByRole('link', { name: 'ログインはこちら' })).toHaveAttribute('href', '/login');

    // CTA から新規登録へ遷移する
    await ctas.first().click();
    await page.waitForURL(/\/signup/);
});

// US1: /lp 単体の a11y（SC-006）
test('/lp - WCAG 2.1 AA 違反なし', async ({ page }) => {
    await page.goto('/lp');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();

    expect(results.violations).toEqual([]);
});

// US2: 既存挙動の退行防止（FR-002）
test('未認証でトップにアクセスするとログイン画面へリダイレクトされる', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/\/login/);
    await expect(page).toHaveURL(/\/login/);
});

test('認証済みでも /lp はリダイレクトされずそのまま閲覧できる', async ({ page }) => {
    await login(page);
    const response = await page.goto('/lp');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/lp$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
});

// US3: metadata / sitemap（FR-009）
test('/lp に OG・Twitter・canonical メタが設定され noindex を含まない', async ({ page }) => {
    await page.goto('/lp');

    await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
    await expect(page.locator('meta[property="og:description"]')).toHaveCount(1);
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveCount(1);

    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute('href', /\/lp$/);

    // インデックス許可（robots に noindex が含まれない）
    const robots = page.locator('meta[name="robots"]');
    if ((await robots.count()) > 0) {
        await expect(robots).not.toHaveAttribute('content', /noindex/);
    }
});

test('sitemap.xml に /lp が含まれる', async ({ page }) => {
    const response = await page.goto('/sitemap.xml');
    const body = (await response?.text()) ?? '';
    expect(body).toContain('/lp');
});

// US3: モバイル表示（FR-010）
test('モバイル幅（375px）で横スクロールが発生しない', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/lp');
    await page.waitForLoadState('networkidle');

    const hasNoOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(hasNoOverflow).toBe(true);
});

test('主要 CTA のタッチターゲットが 44px 以上ある', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/lp');

    const cta = page.getByRole('link', { name: '無料ではじめる' }).first();
    const box = await cta.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
});
