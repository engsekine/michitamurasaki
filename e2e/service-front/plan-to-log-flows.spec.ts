import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

import { presetConsent } from './a11y/_helpers';

/**
 * spec 024 quickstart の E2E 検証。
 * - S1: 当日以前の予定からログへ移動できる（作成 +1 / 予定 -1）
 * - S3: 必須の潜水データ未入力では移動が確定しない
 * - S2: 未来日の予定には移動導線が出ない（一覧・詳細）
 * S5（部分失敗）/ S6（重複防止）は Server Action の Vitest で担保する。
 */

/** supabase/seed.sql のローカル開発専用テストユーザー */
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'password123';

// ダイブ番号の一意制約衝突を避けるため直列実行する
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

/** 予定を 1 件作成し、作成後の詳細ページ（/plans/{id}）で止まる */
const createPlan = async (page: Page, plannedOn: string, location: string) => {
    await page.goto('/plans/new');
    await page.getByLabel(/予定日/).fill(plannedOn);
    await page.getByLabel(/ポイント名/).fill(location);
    await page.getByRole('button', { name: '作成する' }).click();
    await page.waitForURL(/\/plans\/[0-9a-f-]+$/);
};

/**
 * 指定ポイント名の予定を一覧からすべて削除する後始末ヘルパー。
 * 送信の二重発火や過去実行の中断で同名の予定が複数残っていても自己回復できるようループする。
 */
const deletePlansByLocation = async (page: Page, location: string) => {
    await page.goto('/plans');
    while ((await page.getByRole('listitem').filter({ hasText: location }).count()) > 0) {
        const item = page.getByRole('listitem').filter({ hasText: location }).first();
        // これからの予定カードは「予定の詳細」リンク、終了済みカードはカード全体が 1 つのリンク
        const detailLink = item.getByRole('link', { name: '予定の詳細' });
        if ((await detailLink.count()) > 0) {
            await detailLink.click();
        } else {
            await item.getByRole('link').first().click();
        }
        await page.waitForURL(/\/plans\/[0-9a-f-]+$/);
        await page.getByRole('button', { name: /削除/ }).first().click();
        await page.getByRole('dialog').getByRole('button', { name: /削除/ }).click();
        await page.waitForURL(/\/plans$/);
    }
};

test('S1: 当日以前の予定をログへ移動できる（引き継ぎ + 予定削除）', async ({ page }) => {
    await login(page);

    const location = 'S1 予定→ログ移動の検証';
    await createPlan(page, '2024-06-30', location);

    // 予定詳細の「ログに記録する」から新規ログフォームへ
    await page.getByRole('link', { name: `${location}の予定をログに記録する` }).click();
    await page.waitForURL(/\/dives\/new\?fromPlanId=/);

    // 予定日・ポイント名が引き継がれている
    await expect(page.getByLabel(/ポイント名/)).toHaveValue(location);
    await expect(page.getByLabel(/潜水日/)).toHaveValue('2024-06-30');

    // 必須の潜水データを入力（ダイブ番号は失敗残骸と衝突しないよう実行ごとに一意な値を使う）
    await page.getByLabel('ダイブ番号').fill(String(9000 + (Date.now() % 900)));
    await page.getByLabel(/最大水深/).fill('18');
    await page.getByLabel(/潜水時間/).fill('45');
    await page.getByRole('button', { name: '作成する' }).click();

    // ログ詳細へ遷移し、作成されたログが表示される
    await page.waitForURL(/\/dives\/[0-9a-f-]+$/);
    // パンくずにも同名が出るため見出しに絞る
    await expect(page.getByRole('heading', { name: new RegExp(location) })).toBeVisible();

    const diveUrl = new URL(page.url()).pathname;

    // 元の予定は消えている
    await page.goto('/plans');
    await expect(page.getByText(location)).toHaveCount(0);

    // 後始末: 作成したログを削除する（再実行時のダイブ番号残骸を残さない）
    await page.goto(diveUrl);
    await page.getByRole('button', { name: /削除/ }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: /削除/ }).click();
    await page.waitForURL(/\/dives$/);
});

test('S3: 必須の潜水データ未入力では移動が確定しない', async ({ page }) => {
    await login(page);

    const location = 'S3 必須未入力の検証';
    await createPlan(page, '2024-06-30', location);
    await page.getByRole('link', { name: `${location}の予定をログに記録する` }).click();
    await page.waitForURL(/\/dives\/new\?fromPlanId=/);

    // 最大水深を空にして保存 → バリデーションで弾かれ遷移しない
    await page.getByLabel(/最大水深/).fill('');
    await page.getByRole('button', { name: '作成する' }).click();

    await expect(page).toHaveURL(/\/dives\/new\?fromPlanId=/);

    // 後始末: 予定は残っているので削除する（過去実行の残骸で同名が複数あっても first で判定）
    await page.goto('/plans');
    await expect(page.getByText(location).first()).toBeVisible();
    await deletePlansByLocation(page, location);
});

test('S2: 未来日の予定には移動導線が出ない（一覧・詳細）', async ({ page }) => {
    await login(page);

    const location = 'S2 未来日ゲートの検証';
    await createPlan(page, '2099-12-01', location);

    // 詳細ページに「ログに記録する」が無い
    await expect(page.getByRole('link', { name: /ログに記録する/ })).toHaveCount(0);

    // 一覧でも当該予定に導線が無い
    await page.goto('/plans');
    await expect(page.getByRole('link', { name: `${location}の予定をログに記録する` })).toHaveCount(0);

    // a11y: 導線を含む一覧に WCAG 2.1 AA 違反がない
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);

    // 後始末（同名の予定が複数残っていても全部消せるヘルパーで削除）
    await deletePlansByLocation(page, location);
});
