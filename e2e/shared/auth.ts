import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';

import type { TestUser } from './users';

/**
 * 認証まわりの共通処理。
 *
 * なぜ setup project にまとめるか: 以前は全 spec が同じ 5 行のログイン操作を持ち、
 * テストごとにフォームを操作していた（重複・実行時間・ログイン画面の変更に全 spec が追随する保守コスト）。
 * Playwright 公式の認証パターンに合わせ、各アプリの auth.setup.ts（project "<app>:setup"）で 1 回ログインして
 * Cookie を storageState に保存し、依存する project の全テストはログイン済み状態から始める。
 */

const E2E_ROOT = fileURLToPath(new URL('..', import.meta.url));

/** setup project が保存し、各 project の use.storageState が読む Cookie の保存先（gitignore 済み） */
export const STORAGE_STATE = {
    serviceFront: join(E2E_ROOT, '.auth', 'service-front-user.json'),
    adminFront: join(E2E_ROOT, '.auth', 'admin-front-superadmin.json'),
} as const;

/**
 * 未認証で始めたいテスト用。project 既定のログイン済み storageState を打ち消す。
 * ファイル先頭または test.describe 内で test.use({ storageState: NO_AUTH }) と書く。
 */
export const NO_AUTH: { cookies: never[]; origins: never[] } = { cookies: [], origins: [] };

/**
 * メール / パスワードでログインし、ログイン後の遷移先（/）に到達するまで待つ。
 * service-front / admin-front のログインフォームは同じラベル構成なので共用する。
 * setup project のほか、別ユーザー・別コンテキストでログインしたいテストからも直接呼ぶ。
 */
export const loginWithPassword = async (page: Page, user: TestUser): Promise<void> => {
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(user.email);
    await page.getByLabel('パスワード').fill(user.password);
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');
};

/** ログイン済みコンテキストの Cookie を storageState として保存する（setup project から呼ぶ） */
export const saveStorageState = async (page: Page, path: string): Promise<void> => {
    mkdirSync(dirname(path), { recursive: true });
    await page.context().storageState({ path });
};

/**
 * App Router のクライアント側ハイドレーション完了を待つ。
 *
 * なぜ: react-hook-form のフォームにハイドレーション前（SSR 直後）に fill すると、
 * ハイドレーション時に React が初期値で上書きし、入力が消える／自動入力の後ろに追記される
 * （CI の低速な dev サーバーで再現）。フォーム入力の前に呼ぶ。
 * どうやるか: React はハイドレーション時に DOM ノードへ内部プロパティ（`__reactProps$…`）を付与するので、
 * 対象要素（既定は最初の form）にそれが現れるまで待つ。`networkidle` は dev サーバーが HMR 等の
 * 接続を保持するため収束せずタイムアウトすることがあり使わない。
 */
export const waitForHydration = async (page: Page, selector = 'form'): Promise<void> => {
    await page.waitForFunction((sel) => {
        const element = document.querySelector(sel);
        return element !== null && Object.keys(element).some((key) => key.startsWith('__reactProps'));
    }, selector);
};
