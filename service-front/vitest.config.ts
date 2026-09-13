import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    resolve: {
        tsconfigPaths: true,
        alias: {
            // `server-only` は実行環境に存在しない番兵モジュール。空 stub に逃がして
            // createClient 系クエリ（'server-only' 付き）の単体テストを実行可能にする
            'server-only': path.resolve(dirname, 'vitest.server-only-stub.ts'),
        },
    },
    test: {
        coverage: {
            provider: 'v8',
            include: ['src/**/*.{ts,tsx}'],
            exclude: [
                // 型・定数・再 export
                'src/**/*.d.ts',
                'src/**/*.stories.tsx',
                'src/**/index.ts',
                'src/**/types.ts',
                'src/**/constants.ts',
                // Next.js 規約ファイル（E2E でカバー）
                'src/app/**/layout.tsx',
                'src/app/**/loading.tsx',
                'src/app/**/error.tsx',
                'src/app/**/not-found.tsx',
                'src/app/**/page.tsx',
                'src/app/**/route.ts',
                'src/app/sitemap.ts',
                'src/app/providers.tsx',
                'src/middleware.ts',
                'src/proxy.ts',
                'src/shared/lib/supabase/middleware.ts',
                // Server Components / Server Actions（E2E or integration テストでカバー）
                'src/**/server/actions.ts',
                'src/**/server/queries.ts',
                'src/**/components/server/**',
                // 設定 / wiring（ロジックを持たない）
                'src/shared/lib/react-query.ts',
                'src/shared/config/metadata.ts',
            ],
            thresholds: {
                branches: 70,
                functions: 70,
                lines: 70,
                statements: 70,
            },
        },
        projects: [
            {
                extends: true,
                test: {
                    name: 'unit',
                    environment: 'jsdom',
                    globals: true,
                    setupFiles: ['./vitest.setup.ts'],
                    include: ['src/**/*.{test,spec}.{ts,tsx}', '__tests__/**/*.{test,spec}.{ts,tsx}'],
                    exclude: ['node_modules', '.next', 'playwright', '**/*.stories.{ts,tsx}'],
                },
            },
            {
                extends: true,
                plugins: [storybookTest({ configDir: path.join(dirname, '.storybook') })],
                test: {
                    name: 'storybook',
                    browser: {
                        enabled: true,
                        headless: true,
                        provider: playwright({}),
                        instances: [{ browser: 'chromium' }],
                    },
                },
            },
        ],
    },
});
