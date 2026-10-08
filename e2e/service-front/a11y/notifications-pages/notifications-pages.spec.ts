import { expectNoViolations } from '../../../shared/a11y';
import { expect, test } from '../../../shared/test';

test('通知一覧 - WCAG 2.1 AA 違反なし（要認証 / 025）', async ({ page }) => {
    // ヘッダーの通知アイコンから遷移できる（FR-004）。
    // ヘッダー刷新で通知アイコンは直接リンクからベルパネル（Sheet）を開くボタンに変わったため、
    // パネル内の「すべての通知を見る」経由で /notifications へ遷移する
    // （ログインは setup project 済み。ヘッダー操作の起点として TOP を開く）
    await page.goto('/');
    await page.getByRole('button', { name: /^通知/ }).click();
    await page.getByRole('link', { name: 'すべての通知を見る' }).click();
    await page.waitForURL(/\/notifications/);
    await expect(page.getByRole('heading', { name: '通知', exact: true })).toBeVisible();
    await expectNoViolations(page);
});

test('通知設定 - WCAG 2.1 AA 違反なし（要認証 / 025）', async ({ page }) => {
    await page.goto('/settings/notifications');
    await expect(page.getByRole('heading', { name: '通知設定' })).toBeVisible();
    // 5 種別のトグルが存在する（025 FR-011 の 4 種別 + 027 で追加された log_liked。NOTIFICATION_TYPES と同数）
    await expect(page.getByRole('switch')).toHaveCount(5);
    await expectNoViolations(page);
});
