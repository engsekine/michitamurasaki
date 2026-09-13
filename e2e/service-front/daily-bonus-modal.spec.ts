import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

import { presetConsent } from './a11y/_helpers';

/**
 * spec 036（デイリーボーナス獲得モーダル）の E2E 検証。
 *
 * ⚠️ 前提: `make supabase-reset` 直後に実行すること。
 * bonus@example.com は seed で当日分の daily_bonus を付与していない専用ユーザーで、
 * 初回ログインの付与でモーダルが表示される。付与は冪等（1 日 1 回）のため、
 * 同日中の再実行にはふたたび db reset が必要。
 * 他の seed ユーザー（test@ など）は当日分を事前付与済みでモーダルは出ない。
 */

const BONUS_EMAIL = 'bonus@example.com';
const TEST_EMAIL = 'test@example.com';
const PASSWORD = 'password123';

// bonus@example.com の付与状態を共有するため直列実行する
test.describe.configure({ mode: 'serial' });

// dev サーバーのオンデマンドコンパイル（/dives → /dives/new + React Compiler）が
// 初回はローカル既定の 30 秒に収まらないことがあるため延長する
test.setTimeout(90_000);

test.beforeEach(async ({ context }) => {
    await presetConsent(context);
});

const login = async (page: Page, email: string) => {
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(email);
    await page.getByLabel('パスワード').fill(PASSWORD);
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');
};

test('US1+US2: 当日初回の訪問でモーダルが表示され、ログ作成へ進め、再表示されない', async ({ page }) => {
    await login(page, BONUS_EMAIL);

    // 付与は認証必須ページ（(authenticated) グループ）への当日初アクセスで発生する。
    // TOP（/）はグループ外のため、/dives へ遷移して付与とモーダル表示を確認する
    await page.goto('/dives');

    // 付与が発生した訪問でモーダルが表示される（FR-001 / FR-002）。
    // ダイアログは Portal 経由でハイドレーション後にマウントされるため、
    // dev サーバーの初回コンパイルが重なると既定 5 秒では不足しうる → 延長
    const dialog = page.getByRole('dialog', { name: 'デイリーボーナス獲得！' });
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    await expect(dialog.getByText('ログ枠が 1 つ増えました')).toBeVisible();
    await expect(dialog.getByText(/現在の残り枠: \d+/)).toBeVisible();

    // モーダル表示状態で WCAG 2.1 AA 違反なし（SC-003）
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);

    // 「ログを書く」でログ作成ページへ遷移する（US2 / FR-004。Esc・閉じるボタンは単体テストで担保）
    await dialog.getByRole('link', { name: 'ログを書く' }).click();
    await page.waitForURL(/\/dives\/new$/);
    await expect(page.getByRole('dialog', { name: 'デイリーボーナス獲得！' })).toHaveCount(0);

    // 別ページへ戻っても再表示されない（クライアント遷移では layout が再実行されない / FR-003）
    await page.goto('/dives');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('dialog', { name: 'デイリーボーナス獲得！' })).toHaveCount(0);

    // ハードリロードでも再表示されない（付与済みのため RPC が false / SC-002）
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('dialog', { name: 'デイリーボーナス獲得！' })).toHaveCount(0);
});

test('事前付与済みユーザー（既存 E2E ユーザー）にはモーダルが表示されない', async ({ page }) => {
    await login(page, TEST_EMAIL);

    // 認証必須ページを開いても、当日分は seed で事前付与済みのためモーダルは出ない
    await page.goto('/dives');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('dialog', { name: 'デイリーボーナス獲得！' })).toHaveCount(0);
});
