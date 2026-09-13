import { expect, type Page, test } from '@playwright/test';

import { presetConsent } from './a11y/_helpers';

/** Cookie 同意バナーが操作に重ならないようプリセット（017-cookie-consent） */
test.beforeEach(async ({ context }) => {
    await presetConsent(context);
});

/** supabase/seed.sql のローカル開発専用テストユーザー */
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'password123';

const login = async (page: Page) => {
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(TEST_EMAIL);
    await page.getByLabel('パスワード').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');
};

test('申し込みシート: 名前を付けて保存 → 一覧から選択で全項目復元 → 削除（FR-010）', async ({ page }) => {
    // 繰り返し実行しても前回分と衝突しないようシート名を一意にする
    const sheetName = `E2E テスト ${Date.now()}`;
    // 削除確認の confirm ダイアログは常に承認する
    page.on('dialog', (dialog) => void dialog.accept());

    await login(page);
    await page.goto('/application-sheet');

    // 手入力 + レンタル選択（スナップショットに含まれることを確認するため）
    await page.getByLabel('携帯電話').fill('090-1111-2222');
    await page.getByLabel('最寄りの駅').fill('保存テスト駅');
    await page.getByRole('group', { name: 'レンタル器材の有無' }).getByLabel('有').check();
    await page.getByLabel('フィン').check();

    // 名前を付けて保存
    await page.getByLabel('シート名').fill(sheetName);
    await page.getByRole('button', { name: 'シートを保存する' }).click();
    await expect(page.getByRole('status').filter({ hasText: '保存しました' })).toBeVisible();
    // 以降は上書き保存になる
    await expect(page.getByRole('button', { name: '上書き保存する' })).toBeVisible();

    // 再訪問 → 一覧に表示され、選択するとレンタル選択も含めて復元される
    await page.goto('/');
    await page.goto('/application-sheet');
    await page.getByRole('link', { name: new RegExp(sheetName) }).click();
    await page.waitForURL(/application-sheet\?sheet=/);

    await expect(page.getByLabel('シート名')).toHaveValue(sheetName);
    await expect(page.getByLabel('携帯電話')).toHaveValue('090-1111-2222');
    await expect(page.getByLabel('最寄りの駅')).toHaveValue('保存テスト駅');
    await expect(page.getByRole('group', { name: 'レンタル器材の有無' }).getByLabel('有')).toBeChecked();
    await expect(page.getByLabel('フィン')).toBeChecked();

    // 開いているシートを削除すると新規作成状態に戻り、一覧から消える
    await page.getByRole('button', { name: `${sheetName}を削除` }).click();
    await page.waitForURL((url) => url.pathname === '/application-sheet' && !url.searchParams.has('sheet'));
    await expect(page.getByRole('link', { name: new RegExp(sheetName) })).toHaveCount(0);
});

test('申し込みシート: 基本情報と経験を保存すると新規シート作成時に自動入力される', async ({ page }) => {
    const phone = `090${String(Date.now()).slice(-8)}`;

    await login(page);
    await page.goto('/application-sheet');

    // 基本情報 + 経験を入力して専用ボタンで保存
    await page.getByLabel('携帯電話').fill(phone);
    await page.getByLabel('最寄りの駅').fill('基本情報テスト駅');
    await page.getByLabel('ライセンスランク').fill('基本情報テストランク');
    await page.getByRole('button', { name: '基本情報を保存する' }).click();
    await expect(page.getByRole('status').filter({ hasText: '基本情報を保存しました' })).toBeVisible();

    // 再訪問（新規シート作成状態）で基本情報・経験とも自動入力されている
    await page.goto('/');
    await page.goto('/application-sheet');
    await expect(page.getByLabel('携帯電話')).toHaveValue(phone);
    await expect(page.getByLabel('最寄りの駅')).toHaveValue('基本情報テスト駅');
    await expect(page.getByLabel('ライセンスランク')).toHaveValue('基本情報テストランク');
});

test('申し込みシート: TOP ダッシュボードの導線から遷移できる（FR-001）', async ({ page }) => {
    await login(page);

    await page.goto('/');
    await page.getByRole('link', { name: '申し込みシートを作る' }).click();
    await page.waitForURL(/\/application-sheet/);
    await expect(page.getByRole('heading', { name: '申し込みシート', level: 1 })).toBeVisible();
});

test('申し込みシート: 未認証アクセスは /login へリダイレクトされる', async ({ page }) => {
    await page.goto('/application-sheet');
    await page.waitForURL(/\/login/);
    await expect(page.getByLabel('メールアドレス')).toBeVisible();
});
