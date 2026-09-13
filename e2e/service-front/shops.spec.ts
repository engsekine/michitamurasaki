import { expect, type Page, test } from '@playwright/test';

import { presetConsent } from './a11y/_helpers';

/**
 * ショップ管理（033-dive-shops）の E2E 検証。quickstart.md のシナリオに対応する。
 * - US1: 登録 → 一覧 → 詳細 → 編集 → 削除の CRUD 一式・バリデーション・認証ガード
 * a11y（axe）は tests/a11y/shops-pages.spec.ts が担保する。
 */

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

/** テスト内で作成したショップを詳細ページから削除する（後始末） */
const deleteShopFromDetail = async (page: Page) => {
    await page.getByRole('button', { name: '削除', exact: true }).click();
    await page.getByRole('button', { name: '削除する' }).click();
    await page.waitForURL(/\/shops$/);
};

test.beforeEach(async ({ context }) => {
    await presetConsent(context);
});

// US2（認証ガード・spec 033 と proxy の契約）
test('未認証で /shops にアクセスするとログイン画面へリダイレクトされる', async ({ page }) => {
    await page.goto('/shops');
    await page.waitForURL(/\/login/);
    await expect(page).toHaveURL(/\/login/);
});

// US1: 登録 → 一覧 → 詳細 → 編集 → 削除（quickstart シナリオ 1）
test('ショップの登録・一覧・詳細・編集・削除が一連で行える', async ({ page }) => {
    // 失敗時の残骸と衝突しないよう実行ごとに一意な名前を使う
    const CRUD_SHOP_NAME = `E2E テストショップ_${Date.now()}`;
    await login(page);

    // ヘッダーナビから一覧へ
    await page.goto('/shops');
    await expect(page.getByRole('heading', { level: 1, name: 'ショップ' })).toBeVisible();

    // 登録
    await page.getByRole('link', { name: 'ショップを登録' }).first().click();
    await page.waitForURL(/\/shops\/new/);
    await page.getByLabel(/ショップ名/).fill(CRUD_SHOP_NAME);
    await page.getByLabel(/電話番号/).fill('0120-111-222');
    await page.getByLabel(/Web サイト URL/).fill('https://example.com/e2e');
    await page.getByLabel(/メモ/).fill('E2E 用のメモ');
    await page.getByRole('button', { name: '登録する' }).click();

    // 詳細に遷移し、全項目が表示される
    await page.waitForURL(/\/shops\/[0-9a-f-]+$/);
    await expect(page.getByRole('heading', { level: 1, name: CRUD_SHOP_NAME })).toBeVisible();
    await expect(page.getByRole('link', { name: '0120-111-222' })).toHaveAttribute('href', 'tel:0120-111-222');
    const website = page.getByRole('link', { name: 'https://example.com/e2e' });
    await expect(website).toHaveAttribute('target', '_blank');

    // 一覧に表示される
    await page.goto('/shops');
    await expect(page.getByRole('link', { name: new RegExp(CRUD_SHOP_NAME) })).toBeVisible();

    // 編集
    await page.getByRole('link', { name: new RegExp(CRUD_SHOP_NAME) }).click();
    await page.getByRole('link', { name: '編集' }).click();
    await page.waitForURL(/\/shops\/[0-9a-f-]+\/edit$/);
    await page.getByLabel(/ショップ名/).fill(`${CRUD_SHOP_NAME}（更新）`);
    await page.getByRole('button', { name: '更新する' }).click();
    await page.waitForURL(/\/shops\/[0-9a-f-]+$/);
    await expect(page.getByRole('heading', { level: 1, name: `${CRUD_SHOP_NAME}（更新）` })).toBeVisible();

    // 削除 → 一覧から消える
    await deleteShopFromDetail(page);
    await expect(page.getByRole('link', { name: new RegExp(CRUD_SHOP_NAME) })).toHaveCount(0);
});

test('ショップ名が空のまま登録するとエラーが表示され登録されない', async ({ page }) => {
    await login(page);
    await page.goto('/shops/new');

    await page.getByRole('button', { name: '登録する' }).click();

    await expect(page.getByText('ショップ名を入力してください')).toBeVisible();
    await expect(page).toHaveURL(/\/shops\/new/);
});

test('不正な URL 形式ではエラーが表示され登録されない', async ({ page }) => {
    await login(page);
    await page.goto('/shops/new');

    await page.getByLabel(/ショップ名/).fill('URL 検証ショップ');
    await page.getByLabel(/Web サイト URL/).fill('htp://example');
    await page.getByRole('button', { name: '登録する' }).click();

    await expect(page.getByText('Web サイト URL は http(s):// から始まる URL を入力してください')).toBeVisible();
    await expect(page).toHaveURL(/\/shops\/new/);
});

test('ヘッダーナビに「ショップ」導線が表示される', async ({ page }) => {
    await login(page);
    await expect(page.getByRole('link', { name: 'ショップ', exact: true })).toHaveAttribute('href', '/shops');
});

// US3: 住所確定で地図プレビューが自動更新される（quickstart シナリオ 2）。
// GOOGLE_MAPS_API_KEY はサーバー側 env のためテストプロセスから参照できず、
// キー未設定環境では「地図を表示できない」メッセージ側に倒れる。どちらかが必ず表示されることを検証する。
test('住所を入力して確定すると、地図プレビューまたは「表示できない」メッセージが自動で出る', async ({ page }) => {
    await login(page);
    await page.goto('/shops/new');

    await page.getByLabel(/住所/).fill('静岡県伊東市富戸');
    await page.getByLabel(/ショップ名/).click(); // 住所欄からフォーカスを外して確定する

    const mapPreview = page.getByTitle('入力中の住所 の地図');
    const unavailable = page.getByRole('status').filter({ hasText: '住所から地図を表示できません' });
    await expect(mapPreview.or(unavailable).first()).toBeVisible({ timeout: 15_000 });

    // 住所を空に戻して確定するとプレビュー自体が消える（US3-4 相当）
    await page.getByLabel(/住所/).fill('');
    await page.getByLabel(/ショップ名/).click();
    await expect(mapPreview).toHaveCount(0);
    await expect(unavailable).toHaveCount(0);
});

/** 2 人目のローカル開発専用テストユーザー（公開ビュー検証用） */
const BUDDY_EMAIL = 'buddy@example.com';

// US2: 紐付け → 詳細表示 → 逆引き → 公開ビュー非表示 → 削除で紐付けのみ解除（quickstart シナリオ 3〜5）
test('予定・ログ・シートへの紐付けと、ショップ削除時の解除・公開ビュー非表示が機能する', async ({ page, browser }) => {
    // 失敗時の残骸と衝突しないよう実行ごとに一意な名前を使う（selectOption の label 一致を一意にする）
    const SHOP_NAME = `紐付けテストショップ_${Date.now()}`;
    // ダイブ番号はユーザー内一意のため、失敗残骸と衝突しない値を実行ごとに採る
    const DIVE_NUMBER = String(9000 + (Date.now() % 999));
    await login(page);

    // ショップを登録
    await page.goto('/shops/new');
    await page.getByLabel(/ショップ名/).fill(SHOP_NAME);
    await page.getByRole('button', { name: '登録する' }).click();
    await page.waitForURL(/\/shops\/[0-9a-f-]+$/);
    const shopUrl = new URL(page.url()).pathname;

    // 予定に紐付け → 予定詳細にショップ名（リンク）
    await page.goto('/plans/new');
    await page.getByLabel(/ポイント名/).fill('紐付けテスト予定');
    await page.getByLabel(/ショップ/).selectOption({ label: SHOP_NAME });
    await page.getByRole('button', { name: '作成する' }).click();
    await page.waitForURL(/\/plans\/[0-9a-f-]+$/);
    const planUrl = new URL(page.url()).pathname;
    await expect(page.getByRole('link', { name: SHOP_NAME })).toHaveAttribute('href', shopUrl);

    // ログに紐付け → ログ詳細にショップ名（リンク）
    await page.goto('/dives/new');
    await page.getByLabel(/潜水日/).fill('2026-05-10');
    await page.getByLabel('ダイブ番号').fill(DIVE_NUMBER);
    await page.getByLabel(/ポイント名/).fill('紐付けテストログ');
    await page.getByLabel(/最大水深/).fill('18');
    await page.getByLabel(/潜水時間/).fill('40');
    await page.getByLabel(/ショップ/).selectOption({ label: SHOP_NAME });
    await page.getByRole('button', { name: '作成する' }).click();
    await page.waitForURL(/\/dives\/[0-9a-f-]+$/);
    const diveUrl = new URL(page.url()).pathname;
    await expect(page.getByRole('link', { name: SHOP_NAME })).toHaveAttribute('href', shopUrl);

    // 申し込みシートの宛先ショップをシートに保存 → 保存済みシートを開くと復元される（FR-009）
    const SHEET_NAME = `紐付けテストシート_${Date.now()}`;
    await page.goto('/application-sheet');
    // ハイドレーション完了前の selectOption は react-hook-form に拾われないため、
    // 入力がプレビューへ反映される（= React が動いている）ことを確認してから選択する
    await page.getByLabel('お名前').fill('紐付け テスト');
    await expect(page.getByLabel('生成テキスト')).toHaveValue(/紐付け テスト/);
    await page.getByLabel(/宛先ショップ/).selectOption({ label: SHOP_NAME });
    await page.getByLabel('シート名').fill(SHEET_NAME);
    await page.getByRole('button', { name: 'シートを保存する' }).click();
    // 保存の往復（dev サーバーの初回コンパイル含む）に時間がかかることがあるため長めに待つ
    await expect(page.getByText('保存しました')).toBeVisible({ timeout: 15_000 });
    await page.goto('/application-sheet');
    await page.getByRole('link', { name: SHEET_NAME }).click();
    await page.waitForURL(/\/application-sheet\?sheet=/);
    await expect(page.getByLabel(/宛先ショップ/)).toHaveValue(shopUrl.split('/').pop() as string);

    // ショップ詳細の逆引き一覧に予定・ログが表示される（FR-016）
    await page.goto(shopUrl);
    await expect(page.getByRole('link', { name: /紐付けテスト予定/ })).toHaveAttribute('href', planUrl);
    await expect(page.getByRole('link', { name: /紐付けテストログ/ })).toHaveAttribute('href', diveUrl);

    // ログを公開し、別ユーザーの公開ビューにショップが表示されないことを確認（FR-015）
    await page.goto(diveUrl);
    await page.getByRole('switch', { name: 'このログを公開する' }).click();
    await expect(page.getByRole('switch', { name: 'このログを公開する' })).toHaveAttribute('aria-checked', 'true');

    const buddyContext = await browser.newContext();
    const buddyPage = await buddyContext.newPage();
    await presetConsent(buddyContext);
    await buddyPage.goto('/login');
    await buddyPage.getByLabel('メールアドレス').fill(BUDDY_EMAIL);
    await buddyPage.getByLabel('パスワード').fill(TEST_PASSWORD);
    await buddyPage.getByRole('button', { name: 'ログイン', exact: true }).click();
    await buddyPage.waitForURL((url) => url.pathname === '/');
    await buddyPage.goto(diveUrl);
    // 公開ログ自体は閲覧できるが、ショップ情報は一切表示されない
    await expect(buddyPage.getByRole('heading', { name: /紐付けテストログ/ })).toBeVisible();
    await expect(buddyPage.getByText(SHOP_NAME)).toHaveCount(0);
    await buddyContext.close();

    // ショップを削除 → 予定・ログは残り、紐付けだけが解除される（FR-010 / SC-005）
    await page.goto(shopUrl);
    await deleteShopFromDetail(page);

    await page.goto(planUrl);
    await expect(page.getByRole('heading', { name: /紐付けテスト予定/ })).toBeVisible();
    await expect(page.getByText(SHOP_NAME)).toHaveCount(0);

    await page.goto(diveUrl);
    await expect(page.getByRole('heading', { name: /紐付けテストログ/ })).toBeVisible();
    await expect(page.getByText(SHOP_NAME)).toHaveCount(0);

    // 後始末: 作成した予定・ログを削除する
    await page.goto(planUrl);
    await page.getByRole('button', { name: '削除', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: /削除/ }).click();
    await page.waitForURL(/\/plans$/);

    await page.goto(diveUrl);
    await page.getByRole('button', { name: /削除/ }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: /削除/ }).click();
    await page.waitForURL(/\/dives$/);

    // 後始末: 保存した申し込みシートを削除する（window.confirm を承諾）
    await page.goto('/application-sheet');
    page.on('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: `${SHEET_NAME}を削除` }).click();
    await expect(page.getByRole('link', { name: SHEET_NAME })).toHaveCount(0);
});
