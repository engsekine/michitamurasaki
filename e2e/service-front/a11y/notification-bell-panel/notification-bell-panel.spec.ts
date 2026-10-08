import { expectNoViolations } from '../../../shared/a11y';
import { expect, type Page, test } from '../../../shared/test';

/**
 * NotificationBellPanel（ヘッダー通知ベル + Sheet）の a11y テスト。
 *
 * 既存の top-page.spec.ts / dashboard-page.spec.ts はベル閉状態のページスキャンのみであり、
 * Sheet を開いた状態（role="dialog" が DOM に展開された状態）は axe の解析対象外になる。
 * ここでは Sheet を明示的に開いた状態で axe スキャンを行う（前例: header-mobile-nav.spec.ts）。
 */

/** TOP（/）へ遷移して描画完了を待つ共通ヘルパー（ログインは setup project 済み） */
const goTop = async (page: Page) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
};

test('NotificationBellPanel - Sheet 開状態 - WCAG 2.1 AA 違反なし（要認証）', async ({ page }) => {
    // seed.sql に通知データがない場合は「通知はありません」の空状態でスキャンされる
    await goTop(page);

    // ベルボタンをクリックして Sheet（role="dialog"）を開く
    await page.getByRole('button', { name: /通知/ }).click();

    // SheetTitle と /notifications への導線が表示されるまで待機
    await expect(page.getByRole('dialog').getByRole('heading', { name: '通知' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'すべての通知を見る' })).toBeVisible();
    // Sheet の開きアニメーション（opacity 遷移）が終わる前に axe が走ると、
    // 半透明のコンテンツ越しにオーバーレイが透けた色でコントラストを誤検知するため収束を待つ
    await expect(page.locator('[data-slot="sheet-content"]')).toHaveCSS('opacity', '1');

    await expectNoViolations(page);
});
