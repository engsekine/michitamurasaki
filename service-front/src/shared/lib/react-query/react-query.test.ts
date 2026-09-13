/**
 * getQueryClient の回帰テスト（ブラウザ環境）。
 *
 * QueryClient をモジュールスコープのシングルトンにしていたことで、
 * サーバー側で全リクエストにキャッシュが共有され、initialData が無視されて
 * SSR とクライアントの初回描画が食い違う hydration エラーが発生していた。
 * ブラウザではキャッシュ維持のためシングルトンであることを保証する
 * （サーバー側の分岐は react-query.server.test.ts で検証）。
 */
import { describe, expect, it } from 'vitest';

import { getQueryClient } from './react-query';

describe('getQueryClient（ブラウザ）', () => {
    it('同一インスタンスを返し続ける（キャッシュが失われない）', () => {
        const first = getQueryClient();
        const second = getQueryClient();

        expect(first).toBe(second);
    });

    it('既定のクエリオプションが設定されている', () => {
        const client = getQueryClient();
        const defaults = client.getDefaultOptions();

        expect(defaults.queries?.staleTime).toBe(1000 * 60 * 5);
        expect(defaults.queries?.retry).toBe(1);
        expect(defaults.mutations?.retry).toBe(false);
    });
});
