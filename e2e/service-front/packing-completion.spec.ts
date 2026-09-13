import { expect, type Page, test } from '@playwright/test';

import { presetConsent } from './a11y/_helpers';

/**
 * spec 037（忘れ物確認機能）quickstart の E2E 検証。
 * - S1: 準備完了で忘れ物確認リストに置き換わり、再読み込み後も保持される
 * - S2: 確認チェックが保存され、全確認で「忘れ物なし」表示になる
 * - S3: 解除で準備チェックを保持したまま戻り、再完了で確認状態がリセットされる
 * ガード（FR-007 / FR-009）の網羅は Server Action の Vitest で担保する。
 */

/** supabase/seed.sql のローカル開発専用テストユーザー */
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'password123';

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

/** 指定ポイント名の予定を一覧からすべて削除する後始末ヘルパー（plan-to-log-flows と同型） */
const deletePlansByLocation = async (page: Page, location: string) => {
    await page.goto('/plans');
    while ((await page.getByRole('listitem').filter({ hasText: location }).count()) > 0) {
        const item = page.getByRole('listitem').filter({ hasText: location }).first();
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

test('S1〜S3: 準備完了 → 忘れ物確認 → 解除の一連フロー', async ({ page }) => {
    await login(page);

    const location = '037 忘れ物確認の検証';
    // 失敗残骸を自己回復してから開始
    await deletePlansByLocation(page, location);
    await createPlan(page, '2030-01-15', location);

    // --- S1: 準備チェックを 1 件付けてから完了する（未チェックが残っていても押せる / FR-002） ---
    // チェックは Server Action → router.refresh() 反映のため check() ではなく click() + 状態待ちを使う
    await page.getByRole('checkbox', { name: 'マスク' }).click();
    await expect(page.getByRole('checkbox', { name: 'マスク' })).toBeChecked();
    const totalCount = await page.getByRole('checkbox').count();
    await page.getByRole('button', { name: '準備完了にする' }).click();

    // 忘れ物確認リストへ置き換わり、全項目が未確認から始まる
    await expect(page.getByRole('heading', { name: '忘れ物確認リスト' })).toBeVisible();
    await expect(page.getByText(`/ ${totalCount} 確認済み`)).toBeVisible();
    await expect(page.getByRole('progressbar', { name: '忘れ物確認の進捗' })).toHaveAttribute('aria-valuenow', '0');

    // 再読み込みしても完了状態が保持される（FR-004）
    await page.reload();
    await expect(page.getByRole('heading', { name: '忘れ物確認リスト' })).toBeVisible();

    // /plans のカードも忘れ物確認表示になっている（カードは aria-labelledby 付き section = region）
    await page.goto('/plans');
    const planCard = page.getByRole('region', { name: location });
    await expect(planCard.getByRole('heading', { name: '忘れ物確認', exact: true })).toBeVisible();
    await planCard.getByRole('link', { name: '予定の詳細' }).click();
    await page.waitForURL(/\/plans\/[0-9a-f-]+$/);

    // --- S2: 確認チェックが保存され、全確認で「忘れ物なし」 ---
    await page.getByRole('checkbox', { name: 'マスク' }).click();
    await expect(page.getByRole('progressbar', { name: '忘れ物確認の進捗' })).toHaveAttribute('aria-valuenow', '1');
    await page.reload();
    await expect(page.getByRole('checkbox', { name: 'マスク' })).toBeChecked();

    // 残り全件を確認済みにする
    for (let i = 0; i < totalCount; i++) {
        const checkbox = page.getByRole('checkbox').nth(i);
        if (!(await checkbox.isChecked())) {
            await checkbox.click();
            // Server Action → refresh の反映を待つ（次の操作の安定化）
            await expect(checkbox).toBeChecked();
        }
    }
    await expect(page.getByRole('status')).toHaveText(/忘れ物なし/);

    // --- S3: 解除で準備チェック保持のまま戻り、再完了でリセット ---
    await page.getByRole('button', { name: '完了を解除' }).click();
    await expect(page.getByRole('heading', { name: '持ち物リスト' })).toBeVisible();
    // 準備チェック（1 周目）の状態は保持されている（FR-005）
    await expect(page.getByRole('checkbox', { name: 'マスク' })).toBeChecked();

    await page.getByRole('button', { name: '準備完了にする' }).click();
    await expect(page.getByRole('heading', { name: '忘れ物確認リスト' })).toBeVisible();
    // 確認状態はリセットされ全項目未確認から始まる（Clarifications Q1）
    await expect(page.getByRole('progressbar', { name: '忘れ物確認の進捗' })).toHaveAttribute('aria-valuenow', '0');

    // 後始末
    await deletePlansByLocation(page, location);
});
