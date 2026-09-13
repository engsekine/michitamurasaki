import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

/**
 * E2E（Playwright）の共通設定。service-front / admin-front をアプリから独立した
 * このワークスペースから検証する。
 *
 * - 各アプリの dev サーバーは Playwright が起動する（ホストで別途立てる必要はない）。
 *   ビルド出力は各アプリ配下の `.next-playwright/` に分離し、開発中の `.next/` と
 *   キャッシュを共有して壊れるのを防ぐ（各アプリの next.config.ts が NEXT_DIST_DIR を解釈する）
 * - Playwright の project = アプリ。`--project=service-front` のように片側だけ実行できる
 * - `E2E_APP=service` / `E2E_APP=admin` を指定すると、そのアプリの dev サーバーだけを起動する
 *   （片側だけ回すときの起動コストを減らす。未指定なら両方起動）
 */
const isCI = !!process.env['CI'];

interface AppTarget {
    /** Playwright の project 名 = テストディレクトリ名 */
    name: 'service-front' | 'admin-front';
    /** アプリのディレクトリ（このファイルからの相対パス） */
    dir: string;
    /** テスト専用ポート（開発サーバー 3000 / 3001 と衝突させない） */
    port: number;
}

const APPS: readonly AppTarget[] = [
    { name: 'service-front', dir: '../service-front', port: 9323 },
    { name: 'admin-front', dir: '../admin-front', port: 9324 },
];

const selectedApps = (process.env['E2E_APP'] ?? 'service,admin')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
/** `service` → service-front、`admin` → admin-front のように前方一致で選ぶ */
const enabledApps = APPS.filter((app) => selectedApps.some((selected) => app.name.startsWith(selected)));

const configDir = fileURLToPath(new URL('.', import.meta.url));
const baseUrlOf = (app: AppTarget): string => `http://localhost:${app.port}`;

export default defineConfig({
    testDir: '.',
    fullyParallel: true,
    forbidOnly: isCI,
    retries: isCI ? 2 : 0,
    ...(isCI ? { workers: 1 } : {}),
    reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'html',
    // CI では next dev のオンデマンドコンパイルで初回ナビゲーションが遅いため余裕を持たせる
    ...(isCI ? { timeout: 120_000 } : {}),

    use: {
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        locale: 'ja-JP',
        ...(isCI ? { navigationTimeout: 60_000 } : {}),
    },

    projects: enabledApps.map((app) => ({
        name: app.name,
        testDir: `./${app.name}`,
        use: { ...devices['Desktop Chrome'], baseURL: baseUrlOf(app) },
    })),

    webServer: enabledApps.map((app) => ({
        command: `npx next dev -p ${app.port}`,
        cwd: fileURLToPath(new URL(`${app.dir}/`, `file://${configDir}`)),
        // Docker 側 dev サーバーと .next を共有しないよう専用 dist dir を使う（キャッシュ破損防止）
        env: { ...(process.env as Record<string, string>), NEXT_DIST_DIR: '.next-playwright' },
        url: baseUrlOf(app),
        reuseExistingServer: !isCI,
        // CI（2 コアランナー）では初回コンパイルが遅く起動状況の確認も必要なため stdout を出す
        stdout: isCI ? ('pipe' as const) : ('ignore' as const),
        stderr: 'pipe' as const,
        // CI のコールドスタート（React Compiler 込みの初回コンパイル）は 120 秒を超えるため余裕を持たせる
        timeout: isCI ? 300_000 : 120_000,
    })),
});
