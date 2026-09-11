/**
 * キーセットページネーション用カーソルの安全性検証。
 *
 * なぜ: カーソル値は `query.or(\`dive_date.lt.${cursor.diveDate},...\`)` のように
 * PostgREST のフィルタ文字列へそのまま補間される。クライアントから「もっと見る」で渡る
 * カーソルに `,` `(` `)` を含めるとフィルタ構文を注入でき、想定外の条件や
 * PostgREST エラー（→ 500）を引き起こせる。RLS と user_id 絞り込みで他人の行は取れないが、
 * フィルタ文字列に入れる値は形式を固定して受け付ける。
 *
 * どうやるか: カーソルの各値が UUID / ISO 8601 の日付 / タイムスタンプのいずれかに完全一致するときのみ許可する。
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/** `2026-07-06T12:00:00.123456+00:00` / `2026-07-06 12:00:00+00` / `...Z` を許容する */
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)?$/;

/** キーセットカーソルの 1 値として PostgREST フィルタに埋め込んで安全な形式か */
export const isSafeKeysetValue = (value: unknown): value is string =>
    typeof value === 'string' &&
    (UUID_PATTERN.test(value) || ISO_DATE_PATTERN.test(value) || ISO_TIMESTAMP_PATTERN.test(value));

/** カーソルの全ての値が安全な形式か（空オブジェクトは不正扱い） */
export const isSafeKeysetCursor = (cursor: Record<string, unknown>): boolean => {
    const values = Object.values(cursor);
    return values.length > 0 && values.every(isSafeKeysetValue);
};
