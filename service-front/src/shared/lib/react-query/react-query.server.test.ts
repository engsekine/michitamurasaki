// @vitest-environment node
/**
 * getQueryClient の回帰テスト（サーバー環境）。
 *
 * サーバーで QueryClient を使い回すと、過去リクエストのキャッシュが
 * 残って initialData が無視され、SSR HTML とクライアント初回描画が
 * 食い違う（hydration エラー）。リクエスト間でユーザーデータが
 * 混ざるのを防ぐ意味でも、サーバーでは呼び出しごとに新規インスタンスを
 * 返すことを保証する。
 */
import { describe, expect, it } from 'vitest';

import { getQueryClient } from './react-query';

describe('getQueryClient（サーバー）', () => {
    it('呼び出しごとに新規インスタンスを返す（リクエスト間でキャッシュを共有しない）', () => {
        const first = getQueryClient();
        const second = getQueryClient();

        expect(first).not.toBe(second);
    });
});
