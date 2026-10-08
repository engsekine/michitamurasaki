import { expectNoViolations } from '../../../shared/a11y';
import { waitForHydration } from '../../../shared/auth';
import { expect, test } from '../../../shared/test';

/** コピー機能（navigator.clipboard.writeText）の検証に clipboard-write 権限が必要 */
test.use({ permissions: ['clipboard-write'] });

test('/application-sheet - WCAG 2.1 AA 違反なし（要認証）', async ({ page }) => {
    await page.goto('/application-sheet');
    await expect(page.getByRole('heading', { name: '申し込みシート', level: 1 })).toBeVisible();
    await expectNoViolations(page);

    // レンタル「有」で品目 14 種のチェックボックスを展開した状態でも違反がないこと
    await page.getByRole('group', { name: 'レンタル器材の有無' }).getByLabel('有').check();
    await expect(page.getByLabel('ウエットスーツフルセット')).toBeVisible();
    await expectNoViolations(page);

    // レンタル「無」で省略トグルを表示した状態でも違反がないこと（FR-011 / FR-012）
    await page.getByRole('group', { name: 'レンタル器材の有無' }).getByLabel('無').check();
    await expect(page.getByLabel(/未該当ブロックを省略する/)).toBeVisible();
    await expectNoViolations(page);
});

test('/application-sheet - キーボード操作で入力とコピーができる（要認証）', async ({ page }) => {
    await page.goto('/application-sheet');
    // 自動入力（プロフィール / 保存済み基本情報）はハイドレーション後に反映されるため、
    // その前に空にすると復元されて入力が後ろに追記される。ハイドレーションを待ってからクリアする
    await waitForHydration(page);

    // キーボードのみで入力できる（label 関連付け + フォーカス移動）。
    // お名前は自動入力されるため、いったん空にしてから打ち直す（FR-008 の上書きも兼ねる）
    await page.getByLabel('お名前').fill('');
    await expect(page.getByLabel('お名前')).toHaveValue('');
    await page.getByLabel('お名前').click();
    await page.keyboard.type('山田 太郎');
    await expect(page.getByLabel('生成テキスト')).toHaveValue(/・お名前（山田 太郎）/);

    // Tab / Space でラジオを操作できる（ネイティブ要素）
    const drySuitYes = page.getByRole('group', { name: 'ドライスーツの経験' }).getByLabel('有');
    await drySuitYes.focus();
    await page.keyboard.press('Space');
    await expect(page.getByLabel('生成テキスト')).toHaveValue(/・ドライスーツの経験（有）/);

    // Enter でコピーが実行され role="status" の完了通知が出る（FR-006）
    await page.getByRole('button', { name: 'コピーする' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status').filter({ hasText: 'コピーしました' })).toBeVisible();
});
