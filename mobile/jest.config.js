/**
 * RN コンポーネントテスト（*.test.tsx）用の jest-expo 設定。
 * 純粋ロジック（*.test.ts）は Vitest（vitest.config.ts）が担当する。
 * Vitest を使えないのは RN のトランスフォームに非対応のため（plan.md Complexity Tracking）。
 *
 * monorepo 注意（research R1 / T006）:
 * expo / react-native は peer 解決の都合で mobile/node_modules にネストされる一方、
 * @react-native/jest-preset は root へ hoist されるため、そのままでは
 * preset 内部の require('react-native') が解決できない。対処は 2 点:
 *   1. 設定読み込み中は解決フックでネスト先へフォールバックさせる
 *   2. worker 側でも読み込まれる asset transformer はローカルのスタブに差し替える
 */
const Module = require('node:module');
const path = require('node:path');

const nestedReactNative = path.join(__dirname, 'node_modules', 'react-native');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function patchedResolve(request, ...rest) {
    if (request === 'react-native' || request.startsWith('react-native/')) {
        try {
            return originalResolve.call(this, request, ...rest);
        } catch {
            const subPath = request === 'react-native' ? '.' : request.slice('react-native/'.length);
            return originalResolve.call(this, path.join(nestedReactNative, subPath), ...rest);
        }
    }
    return originalResolve.call(this, request, ...rest);
};

const preset = require('jest-expo/jest-preset');

// asset transformer（@react-native/jest-preset 由来）をローカルスタブへ差し替える
const transform = Object.fromEntries(
    Object.entries(preset.transform ?? {}).map(([pattern, transformer]) => {
        const target = Array.isArray(transformer) ? transformer[0] : transformer;
        if (typeof target === 'string' && target.includes('assetFileTransformer')) {
            return [pattern, path.join(__dirname, 'jest', 'assetTransformer.cjs')];
        }
        return [pattern, transformer];
    }),
);

module.exports = {
    ...preset,
    transform,
    rootDir: __dirname,
    testMatch: ['<rootDir>/src/**/*.test.tsx'],
    passWithNoTests: true,
};
