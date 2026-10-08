import { expectNoViolations } from '../../../shared/a11y';
import { expect, test } from '../../../shared/test';

/** Cookie 同意バナーの有無を含めて検証するため、fixture 既定の同意済みプリセットを打ち消す */
test.use({ cookieConsent: 'unset' });

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
        await expectNoViolations(page);
    });
}
