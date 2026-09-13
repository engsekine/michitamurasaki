/**
 * 画像・フォント等のアセット用スタブ transformer。
 * 既定の @react-native/jest-preset のものは root へ hoist された位置から
 * react-native を解決できない（monorepo のネスト都合）ため、ローカルの空実装で置き換える。
 * テストコードはアセットを import しないため挙動に影響しない。
 */
module.exports = {
    process() {
        return { code: 'module.exports = {};' };
    },
};
