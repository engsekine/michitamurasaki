import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/nextjs-vite';
import tailwindcss from '@tailwindcss/vite';

const storybookDir = dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
    stories: ['./*.mdx', '../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
    addons: [
        getAbsolutePath('@chromatic-com/storybook'),
        getAbsolutePath('@storybook/addon-vitest'),
        getAbsolutePath('@storybook/addon-a11y'),
        getAbsolutePath('@storybook/addon-docs'),
        getAbsolutePath('@storybook/addon-mcp'),
    ],
    framework: getAbsolutePath('@storybook/nextjs-vite'),
    staticDirs: ['../public'],

    viteFinal: (config) => {
        config.plugins = config.plugins ?? [];
        config.plugins.unshift(tailwindcss());
        // sharp はネイティブ addon のためブラウザ実行（storybook / vitest browser mode）では
        // モジュール評価に失敗する。story は Server Action（photoActions → imageProcessing）を
        // 実行しないため stub に逃がす（unit プロジェクトの vitest は実 sharp を使う）
        const sharpStubPath = resolve(storybookDir, 'sharp-stub.ts');
        config.resolve = {
            ...config.resolve,
            alias: Array.isArray(config.resolve?.alias)
                ? [...config.resolve.alias, { find: 'sharp', replacement: sharpStubPath }]
                : { ...config.resolve?.alias, sharp: sharpStubPath },
        };
        return config;
    },
};

export default config;

function getAbsolutePath(value: string): string {
    return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}
