import { expect, type Page, test } from '@playwright/test';

import { presetConsent } from './a11y/_helpers';

/**
 * spec 021 quickstart S1 / S2 の E2E 検証（T052 の自動化分）。
 * - S1: バディ（フリーテキスト）を記録し詳細で表示できる
 * - S2: 公開トグル → 匿名共有 URL で閲覧可 → 非公開化で共有 URL が 404（SC-002 の安全側）
 * S3〜S6 は seed データ制約（公開ログ・2 人目の非 admin ユーザー不足）のため
 * ローカル実 DB での RLS/トリガ検証とフォロー UI の単体/Story で担保する。
 */

/** supabase/seed.sql のローカル開発専用テストユーザー */
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'password123';

// ダイブ番号の一意制約衝突を避けるため直列実行する
test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ context }) => {
    await presetConsent(context);
});

const login = async (page: Page) => {
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(TEST_EMAIL);
    await page.getByLabel('パスワード').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');
};

const createDive = async (page: Page, location: string, diveNumber: number) => {
    await page.goto('/dives/new');
    await page.getByLabel(/潜水日/).fill('2026-04-20');
    // ダイブ番号を明示指定して seed/他テストとの一意制約衝突を避ける
    await page.getByLabel('ダイブ番号').fill(String(diveNumber));
    await page.getByLabel(/ポイント名/).fill(location);
    await page.getByLabel(/最大水深/).fill('20');
    await page.getByLabel(/潜水時間/).fill('42');
};

const deleteCurrentDive = async (page: Page) => {
    await page.getByRole('button', { name: /削除/ }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: /削除/ }).click();
    await page.waitForURL(/\/dives$/);
};

test('S1: フリーテキストのバディを記録し詳細で表示できる', async ({ page }) => {
    await login(page);
    await createDive(page, 'S1 バディ記録の検証', 9101);

    // バディ（フリーテキスト）を 1 件追加して保存
    await page.getByRole('button', { name: 'バディを追加' }).click();
    await page.getByLabel('バディ名 1').fill('テスト相棒');
    await page.getByRole('button', { name: '作成する' }).click();
    await page.waitForURL(/\/dives\/[0-9a-f-]+$/);

    // 詳細の「同行バディ」にフリーテキスト名が表示される
    await expect(page.getByText('同行バディ')).toBeVisible();
    await expect(page.getByText('テスト相棒')).toBeVisible();

    await deleteCurrentDive(page);
});

test('S2: 公開で共有リンク(/dives/[id])が出て直接コピーできる → 匿名は閲覧不可 → 非公開化でリンク消滅（SC-002/005）', async ({
    page,
    browser,
}) => {
    await login(page);
    await createDive(page, 'S2 公開制御の検証', 9102);
    await page.getByRole('button', { name: '作成する' }).click();
    await page.waitForURL(/\/dives\/[0-9a-f-]+$/);
    const divePath = new URL(page.url()).pathname;

    // 公開トグル ON → 共有リンク（{SITE_URL}/dives/<id>）が読み取り専用入力で表示される
    await page.getByRole('switch', { name: 'このログを公開する' }).click();
    const shareInput = page.getByRole('textbox', { name: '共有リンク' });
    await expect(shareInput).toBeVisible();
    await expect(shareInput).toHaveValue(new RegExp(`${divePath}$`));

    // 未ログイン（匿名）で /dives/[id] を開くと閲覧できず /login へ誘導される（匿名共有ページは廃止）
    const anonContext = await browser.newContext();
    try {
        const anonPage = await anonContext.newPage();
        await anonPage.goto(divePath);
        await anonPage.waitForURL(/\/login/);
        await anonPage.close();
    } finally {
        await anonContext.close();
    }

    // 非公開へ戻す → 共有リンク入力が消える（SC-005：閲覧経路を即遮断）
    await page.getByRole('switch', { name: 'このログを公開する' }).click();
    await expect(page.getByText('非公開')).toBeVisible();
    await expect(page.getByRole('textbox', { name: '共有リンク' })).toHaveCount(0);

    await deleteCurrentDive(page);
});

test('S7: ユーザー検索から相手を見つけてフォロー/解除できる', async ({ page }) => {
    await login(page);

    // ユーザー ID（handle）で検索 → seed の admin（handle: admin-ops）がヒットする
    await page.goto('/users/search');
    await page.getByRole('searchbox', { name: 'ユーザーIDで探す' }).fill('admin');
    await page.getByRole('button', { name: '検索' }).click();
    await page.waitForURL(/\/users\/search\?q=admin/);

    // 結果にプロフィールリンクが出る（ニックネームとユーザー ID の両方を表示）
    await expect(page.getByRole('link', { name: 'admin' })).toBeVisible();
    await expect(page.getByText('@admin-ops')).toBeVisible();

    // 再実行耐性: 既にフォロー中なら一旦解除して初期状態へ
    const followingButton = page.getByRole('button', { name: 'フォロー中' });
    if (await followingButton.isVisible().catch(() => false)) {
        await followingButton.click();
        await expect(page.getByRole('button', { name: 'フォロー', exact: true })).toBeVisible();
    }

    // フォロー → フォロー中に変わる
    await page.getByRole('button', { name: 'フォロー', exact: true }).click();
    await expect(page.getByRole('button', { name: 'フォロー中' })).toBeVisible();

    // 後始末: フォロー解除
    await page.getByRole('button', { name: 'フォロー中' }).click();
    await expect(page.getByRole('button', { name: 'フォロー', exact: true })).toBeVisible();
});
