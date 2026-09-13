/**
 * Server Actions の戻り値の共通型（discriminated union）。
 *
 * `success` で成功/失敗を判別できるため、呼び出し側は
 * `if (!result.success)` でエラーメッセージへ型安全にアクセスできる。
 * feature ごとに `{ error?: string }` 形式が乱立していたのを統一する。
 */
export type ActionResult<T extends object = Record<never, never>> =
    | ({ success: true } & T)
    | { success: false; error: string; code?: string };

/** 成功レスポンスを作るヘルパー */
export const actionSuccess = <T extends object>(payload?: T): { success: true } & T =>
    ({ success: true, ...payload }) as { success: true } & T;

/**
 * 失敗レスポンスを作るヘルパー。
 * code は呼び出し側が特定の失敗を機械判別したいときのみ付ける
 * （例: 'no_credit' = ログ枠不足。メッセージ文字列の比較に依存させない）
 */
export const actionFailure = (error: string, code?: string): { success: false; error: string; code?: string } => ({
    success: false,
    error,
    ...(code ? { code } : {}),
});
