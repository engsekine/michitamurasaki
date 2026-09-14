import { expectNoViolations } from '../../../shared/a11y';
import { expect, test } from '../../../shared/test';

test('TOP（ダッシュボード）- 累計ダイビング本数を含めて WCAG 2.1 AA 違反なし（要認証）', async ({ page }) => {
    // TOP（累計ダイビング本数セクションを含む）
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '累計ダイビング本数' })).toBeVisible();
    await expectNoViolations(page);

    // 代替データテーブル（details）を開いた状態でも違反がないこと（FR-009）
    const summaries = page.getByText('データを表で見る');
    const summaryCount = await summaries.count();
    for (let index = 0; index < summaryCount; index++) {
        await summaries.nth(index).click();
    }
    await expectNoViolations(page);
});
