import { expectNoViolations } from '../../../shared/a11y';
import { test } from '../../../shared/test';

test('TOP ダッシュボード - WCAG 2.1 AA 違反なし（要認証）', async ({ page }) => {
    // TOP（「次の予定」カードの潮回りラベル含む）
    await page.goto('/');
    await expectNoViolations(page);
});
