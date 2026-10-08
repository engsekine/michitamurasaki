import { test as setup } from '@playwright/test';

import { loginWithPassword, STORAGE_STATE, saveStorageState } from '../shared/auth';
import { ADMIN_USER } from '../shared/users';

/**
 * admin-front の認証セットアップ（project "admin-front:setup"）。
 * seed の上位管理者で 1 回ログインして Cookie を保存し、project "admin-front" の全テストが
 * ログイン済み状態から始まるようにする。ログイン境界そのものを検証する spec は `NO_AUTH` で打ち消す。
 */
setup('上位管理者でログインし storageState を保存する', async ({ page }) => {
    await loginWithPassword(page, ADMIN_USER);
    await saveStorageState(page, STORAGE_STATE.adminFront);
});
