import { expectNoViolations } from '../../../shared/a11y';
import { test } from '../../../shared/test';

test('/settings/certifications 系 3 画面 - WCAG 2.1 AA 違反なし（要認証）', async ({ page }) => {
    // 一覧（空状態 or 既存データあり、いずれも検証対象）
    await page.goto('/settings/certifications');
    await expectNoViolations(page);

    // 新規登録フォーム
    await page.goto('/settings/certifications/new');
    await expectNoViolations(page);

    // 1 件登録: 指導団体 PADI・資格ランク・取得日を入力して送信。
    // ランク名は実行ごとに一意にする（途中失敗で残骸が残っても
    // 「同じ団体・ランクの資格がすでに登録されています」で再実行不能にならないように）
    const uniqueRank = `a11y テスト用資格 ${Date.now()}`;
    await page.getByLabel('指導団体').selectOption('padi');
    await page.getByLabel('資格ランク').fill(uniqueRank);
    await page.getByLabel('取得日').fill('2023-04-01');
    await page.getByRole('button', { name: '登録する' }).click();
    await page.waitForURL('/settings/certifications');

    // 一覧に戻った直後（登録済みカードが表示された状態）を再検証
    await expectNoViolations(page);

    // 編集画面: 登録したカードの「編集」リンクから動的ルート /settings/certifications/[id]/edit へ遷移
    await page.getByRole('listitem').filter({ hasText: uniqueRank }).getByRole('link', { name: '編集' }).click();
    await page.waitForURL(/\/settings\/certifications\/[0-9a-f-]+\/edit$/);
    await expectNoViolations(page);

    // 後始末: 一覧に戻り、登録した資格を削除（seed の資格を誤って消さないよう名前でスコープ）
    await page.goto('/settings/certifications');
    await page.getByRole('listitem').filter({ hasText: uniqueRank }).getByRole('button', { name: '削除' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '削除する' }).click();
    await page.waitForLoadState('networkidle');
});
