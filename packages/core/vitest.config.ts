import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/**/*.test.ts'],
        environment: 'node',
        // T011 でテストを追加するまでの空実行を許容（CI を壊さない）
        passWithNoTests: true,
    },
});
