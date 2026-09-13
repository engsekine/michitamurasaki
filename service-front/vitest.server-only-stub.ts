// `server-only` は実行環境に存在しない（Next.js が本番で提供する番兵モジュール）。
// vitest では import を解決できず transform エラーになるため、空モジュールへ alias する
// （createClient 系クエリの単体テストを Supabase クライアントモックで実行可能にする）。
export {};
