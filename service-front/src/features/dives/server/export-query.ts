// fetchDivesForExport は supabase を引数で受け取る純粋なクエリ関数のため単体テスト可能にする。
// （createClient を使う listDivesForExport のみがサーバー専用。list-query.ts と同じ方針で 'server-only' は付けない）
import type { Database } from '@repo/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

import { DIVE_FULL_COLUMNS, type DiveRowWithSite, mapDive } from '@/features/dives/lib/dive-mapper';
import { applyDiveListFilter } from '@/features/dives/lib/list-query';
import type { Dive, DiveListFilter } from '@/features/dives/types';

/** 一度のエクスポートで取得する最大件数（contracts/export-endpoint.md） */
export const EXPORT_MAX_ROWS = 500;

export interface ExportQueryOptions {
    /** 出力対象 ID（指定時はフィルタより優先） */
    ids?: string[] | null;
    /** ids 未指定時に適用する絞り込み（機能 013 と同一） */
    filter?: DiveListFilter;
    /**
     * 出力対象の所有者 ID。公開読み取り RLS で他人の公開ログを ids 経由で
     * エクスポートできてしまうのを防ぐため、指定時は user_id で絞る。
     */
    ownerId?: string;
}

/**
 * エクスポート対象の dives を全カラム（+ dive_site 結合）で取得する（本人 RLS）。
 * ids 指定時はその ID 群のみ、未指定時は filter を適用。
 * dive_date 降順・id 降順で安定ソート、最大 EXPORT_MAX_ROWS 件。
 * サーバー・テスト両用にクライアントを引数で受け取れるようにする。
 */
export const fetchDivesForExport = async (
    supabase: SupabaseClient<Database>,
    options: ExportQueryOptions = {},
): Promise<Dive[]> => {
    const { ids, filter, ownerId } = options;

    let query = supabase
        .from('dives')
        .select(DIVE_FULL_COLUMNS)
        .order('dive_date', { ascending: false })
        .order('id', { ascending: false })
        .limit(EXPORT_MAX_ROWS);

    // 本人のログのみエクスポート対象にする（他人の公開ログの ids 指定を弾く）
    if (ownerId) query = query.eq('user_id', ownerId);

    if (ids && ids.length > 0) {
        query = query.in('id', ids);
    } else {
        query = (await applyDiveListFilter(supabase, query, filter)).query;
    }

    const { data, error } = await query;
    if (error || !data) {
        throw new Error(`エクスポート対象の取得に失敗しました: ${error?.message ?? 'no data'}`);
    }

    return (data as unknown as DiveRowWithSite[]).map(mapDive);
};
