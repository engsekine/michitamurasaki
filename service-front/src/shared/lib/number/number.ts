/**
 * PostgreSQL の numeric カラムは Supabase クライアント経由で string として
 * 返ることがあるため、アプリ内の数値型へ正規化する。
 */
export const toNumber = (value: number | string | null | undefined): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
};
