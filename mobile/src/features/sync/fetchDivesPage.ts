import { supabase } from '../../lib/supabase/client';
import type { FetchDivesPage, ServerDiveRow } from './lib/fullSync';

/**
 * dives の keyset ページ取得（fullSync / 機会的リフレッシュ共用）。
 *
 * なぜ user_id で絞るか: RLS は本人のログに加えて「他人の公開ログ」（is_public）も
 * 返すため、RLS 任せにすると他人のログが本人のキャッシュへ「同期済み」として混入し、
 * 全件同期がシステム全体の公開ログをダウンロードしてしまう。
 * 論理削除済みは除外する。
 */
export const fetchDivesPage: FetchDivesPage = async (userId, cursor, limit) => {
    let query = supabase
        .from('dives')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('dive_date', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit);
    if (cursor) {
        query = query.or(`dive_date.lt.${cursor.diveDate},and(dive_date.eq.${cursor.diveDate},id.lt.${cursor.id})`);
    }
    const { data, error } = await query;
    if (error) throw new Error(`ログの取得に失敗しました: ${error.message}`);
    return (data ?? []) as unknown as ServerDiveRow[];
};
