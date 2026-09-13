import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * 管理画面の認証後ページの a11y 検証（015-admin-panel / WCAG 2.1 AA）。
 * ログインは setup project（auth.setup.ts）が済ませているので、ダッシュボードと主要な一覧ページを axe でスキャンする。
 */

const AUTHENTICATED_PAGES: { path: string; heading: string }[] = [
    { path: '/', heading: 'ダッシュボード' },
    { path: '/users', heading: 'ユーザー' },
    { path: '/dives', heading: 'ダイブログ' },
    { path: '/dive-sites', heading: 'ダイブサイト' },
    { path: '/inquiries', heading: 'お問い合わせ' },
    { path: '/audit-logs', heading: '操作ログ' },
];

for (const { path, heading } of AUTHENTICATED_PAGES) {
    test(`${path} - WCAG 2.1 AA 違反なし`, async ({ page }) => {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1, name: new RegExp(heading) })).toBeVisible();

        await page.waitForLoadState('networkidle');
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(results.violations).toEqual([]);
    });
}
