import { expectNoViolations } from '../../shared/a11y';
import { loginWithPassword, NO_AUTH } from '../../shared/auth';
import { revokeTodaysDailyBonus } from '../../shared/db';
import { expect, test } from '../../shared/test';
import { SERVICE_BONUS_USER, SERVICE_USER } from '../../shared/users';

/** このファイルは未認証状態から始める（project 既定のログイン済み storageState を打ち消す） */
test.use({ storageState: NO_AUTH });

/**
 * spec 036（デイリーボーナス獲得モーダル）の E2E 検証。
 *
 * bonus@example.com は seed で当日分の daily_bonus を付与していない専用ユーザーで、
 * 当日初回の付与でモーダルが表示される。付与は冪等（1 日 1 回）なので、
 * 同日中に 2 回目以降を実行すると付与が起きずモーダルが出ない。
 * そのため beforeAll で当日分を DB から取り消し、毎回「未付与」から始める（db reset は不要）。
 * 他の seed ユーザー（test@ など）は当日分を事前付与済みでモーダルは出ない。
 */

// bonus@example.com の付与状態を共有するため直列実行する
test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
    await revokeTodaysDailyBonus(SERVICE_BONUS_USER.email);
});

// dev サーバーのオンデマンドコンパイル（/dives → /dives/new + React Compiler）が
// 初回はローカル既定の 30 秒に収まらないことがあるため延長する
test.setTimeout(90_000);

test('US1+US2: 当日初回の訪問でモーダルが表示され、ログ作成へ進め、再表示されない', async ({ page }) => {
    await loginWithPassword(page, SERVICE_BONUS_USER);

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
    await expectNoViolations(page);

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
    await loginWithPassword(page, SERVICE_USER);

    // 認証必須ページを開いても、当日分は seed で事前付与済みのためモーダルは出ない
    await page.goto('/dives');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('dialog', { name: 'デイリーボーナス獲得！' })).toHaveCount(0);
});
