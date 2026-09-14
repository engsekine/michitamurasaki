import { test as setup } from '@playwright/test';

import { loginWithPassword, STORAGE_STATE, saveStorageState } from '../shared/auth';
import { ensureLogCredits } from '../shared/db';
import { SERVICE_USER } from '../shared/users';

/**
 * ログを作成する E2E が 1 実行で消費する枠より十分大きい残高。
 * seed の初期値（30）と同程度に保ち、同日中に何度実行しても枠切れで落ちないようにする
 */
const MIN_LOG_CREDITS = 30;

/**
 * service-front の認証セットアップ（project "service-front:setup"）。
 * 標準テストユーザーで 1 回ログインして Cookie を保存し、project "service-front" の全テストが
 * ログイン済み状態から始まるようにする。未認証で始めたいテストは `test.use({ storageState: NO_AUTH })` を使う。
 * 併せてログ枠の残高を補充する（ログ作成は 1 件 1 枠を消費し削除しても戻らないため、繰り返し実行で枯渇する）。
 */
setup('標準テストユーザーでログインし storageState を保存する', async ({ page }) => {
    await ensureLogCredits(SERVICE_USER.email, MIN_LOG_CREDITS);
    await loginWithPassword(page, SERVICE_USER);
    await saveStorageState(page, STORAGE_STATE.serviceFront);
});
