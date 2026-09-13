import { isServer, QueryClient } from '@tanstack/react-query';

/**
 * TanStack Query設定
 * データフェッチング、キャッシング、同期のための設定
 */
const makeQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                // データの鮮度保持時間（5分）
                staleTime: 1000 * 60 * 5,

                // キャッシュ時間（10分）
                gcTime: 1000 * 60 * 10,

                // ウィンドウフォーカス時に再取得
                refetchOnWindowFocus: false,

                // マウント時に再取得
                refetchOnMount: true,

                // 再接続時に再取得
                refetchOnReconnect: true,

                // エラー時のリトライ回数
                retry: 1,

                // リトライ遅延（指数バックオフ）
                retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            },
            mutations: {
                // エラー時のリトライなし（mutations）
                retry: false,
            },
        },
    });

let browserQueryClient: QueryClient | undefined;

/**
 * 環境に応じた QueryClient を返す。
 *
 * サーバーではリクエスト（レンダー）ごとに新規インスタンスを返す。
 * モジュールスコープのシングルトンにすると全リクエスト・全ユーザーで
 * キャッシュが共有され、initialData が過去リクエストのキャッシュに無視されて
 * SSR HTML とクライアント初回描画が食い違う（hydration エラー）うえ、
 * ユーザー間でデータが混ざるリスクがある。
 * ブラウザでは Suspense 中の再生成でキャッシュが失われないよう
 * シングルトンを維持する。
 */
export const getQueryClient = (): QueryClient => {
    if (isServer) return makeQueryClient();

    browserQueryClient ??= makeQueryClient();
    return browserQueryClient;
};
