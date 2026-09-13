import { defineConfig } from 'vitest/config';

/**
 * RN 非依存の純粋ロジック（*.test.ts）用。
 * RN コンポーネント（*.test.tsx）は jest-expo（jest.config.js）が担当する。
 */
export default defineConfig({
    test: {
        include: ['src/**/*.test.ts'],
        environment: 'node',
        passWithNoTests: true,
    },
});
