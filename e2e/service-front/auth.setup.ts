import { test as setup } from '@playwright/test';

import { loginWithPassword, STORAGE_STATE, saveStorageState } from '../shared/auth';
import { SERVICE_USER } from '../shared/users';

/**
 * service-front の認証セットアップ（project "service-front:setup"）。
 * 標準テストユーザーで 1 回ログインして Cookie を保存し、project "service-front" の全テストが
 * ログイン済み状態から始まるようにする。未認証で始めたいテストは `test.use({ storageState: NO_AUTH })` を使う。
 */
setup('標準テストユーザーでログインし storageState を保存する', async ({ page }) => {
    await loginWithPassword(page, SERVICE_USER);
    await saveStorageState(page, STORAGE_STATE.serviceFront);
});
