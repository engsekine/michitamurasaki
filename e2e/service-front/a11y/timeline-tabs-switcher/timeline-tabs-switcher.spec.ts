import { expectNoViolations } from '../../../shared/a11y';
import { expect, test } from '../../../shared/test';

/**
 * TimelineTabsSwitcher の各タブパネルが axe の解析対象になる状態（hidden なし）での WCAG 2.1 AA 違反を検証する。
 * top-page.spec.ts / social-pages.spec.ts は初期タブ（「タイムライン」）でのみスキャンするため、
 * hidden 属性で隠れた「いいねしたログ」パネルは axe の対象外になる。ここでは各タブを visible にして検証する。
 */
test('TimelineTabsSwitcher - 「いいねしたログ」タブ表示時 - WCAG 2.1 AA 違反なし（要認証）', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 「いいねしたログ」タブに切り替えてパネルを visible にしてからスキャン
    await page.getByRole('tab', { name: 'いいねしたログ' }).click();
    await expect(page.getByRole('tab', { name: 'いいねしたログ' })).toHaveAttribute('aria-selected', 'true');
    await expectNoViolations(page);
});
