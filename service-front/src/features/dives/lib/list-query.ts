// サーバー（Server Components）とブラウザ（react-query）の両方から
// 使うため、'use client' / 'server-only' は付けない。
import type { Database } from '@repo/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

import { DIVE_PAGE_SIZE } from '@/features/dives/constants';
import type { DiveCursor, DiveListFilter, DiveListItem, DiveListPage, DiveSiteRef } from '@/features/dives/types';
import { isSafeKeysetCursor } from '@/shared/lib/keyset-cursor';
import { toNumber } from '@/shared/lib/number';

/** 一覧表示で取得する列。`DiveListItem` と 1:1 で対応させる（表示名解決のため dive_site を結合） */
export const DIVE_LIST_COLUMNS =
    'id, dive_number, dive_date, location, dive_site_id, max_depth_m, bottom_time_min, water_temp_c, visibility_m, certification_dive, dive_site:dive_sites(id, name, area)';

type DiveRow = Database['public']['Tables']['dives']['Row'];

/** DIVE_LIST_COLUMNS で取得した行（生成型のサブセット + 結合した dive_site） */
type DiveListRow = Pick<
    DiveRow,
    | 'id'
    | 'dive_number'
    | 'dive_date'
    | 'location'
    | 'dive_site_id'
    | 'max_depth_m'
    | 'bottom_time_min'
    | 'water_temp_c'
    | 'visibility_m'
    | 'certification_dive'
> & { dive_site: DiveSiteRef | null };

/**
 * DB の snake_case 行を一覧表示用の camelCase に変換する。
 * numeric カラムは Supabase 経由で string になることがあるため数値へ正規化する。
 */
export const mapDiveListItem = (row: DiveListRow): DiveListItem => ({
    id: row.id,
    diveNumber: row.dive_number,
    diveDate: row.dive_date,
    location: row.location,
    diveSite: row.dive_site ? { id: row.dive_site.id, name: row.dive_site.name, area: row.dive_site.area } : null,
    maxDepthM: Number(row.max_depth_m),
    bottomTimeMin: row.bottom_time_min,
    waterTempC: toNumber(row.water_temp_c),
    visibilityM: toNumber(row.visibility_m),
    certificationDive: row.certification_dive,
});

/** フィルタ適用で必要な Supabase クエリビルダーのメソッドのみを表す構造的型（一覧・エクスポートで共用） */
interface DiveFilterQuery<Q> {
    eq: (column: string, value: string | number) => Q;
    gte: (column: string, value: string | number) => Q;
    lte: (column: string, value: string | number) => Q;
    not: (column: string, operator: string, value: null) => Q;
    or: (filters: string) => Q;
    in: (column: string, values: readonly string[]) => Q;
}

/**
 * `DiveListFilter` を dives クエリに適用する（一覧・エクスポートで共用）。
 * 番号・ダイブタイプは eq、期間・深度は範囲、ポイント名は location とサイト名の or で合流する。
 * ポイント名検索はサイト ID の事前引きが必要なため async。
 */
export const applyDiveListFilter = async <Q extends DiveFilterQuery<Q>>(
    supabase: SupabaseClient<Database>,
    query: Q,
    filter: DiveListFilter | undefined,
    // Supabase クエリビルダーは thenable のため、async 関数から直接 return すると await 時に
    // ビルダーが解決されてしまう。オブジェクトで包んで返し、呼び出し側で .query を取り出す。
): Promise<{ query: Q }> => {
    if (!filter) return { query };

    let next = query;
    if (filter.diveNumber !== undefined) next = next.eq('dive_number', filter.diveNumber);
    if (filter.diveType) next = next.eq('dive_type', filter.diveType);
    // 期間（潜水日）: 両端を含む範囲。片側のみは開いた範囲（FR-001）
    if (filter.dateFrom) next = next.gte('dive_date', filter.dateFrom);
    if (filter.dateTo) next = next.lte('dive_date', filter.dateTo);
    // 深度範囲（最大水深）: 下限・上限のいずれか指定時は未記録（null）を除外する（FR-002）
    if (filter.depthMin !== undefined || filter.depthMax !== undefined) {
        next = next.not('max_depth_m', 'is', null);
    }
    if (filter.depthMin !== undefined) next = next.gte('max_depth_m', filter.depthMin);
    if (filter.depthMax !== undefined) next = next.lte('max_depth_m', filter.depthMax);
    // ポイント名検索（FR-013）: 自由入力名（location）と参照サイト名の双方に一致させる。
    // サイト参照ログは location が null のため、名前が一致するサイト ID を先に引いて OR で合流する。
    if (filter.location) {
        // or() の raw フィルタ予約文字（, ( ) * "）に加え、LIKE のワイルドカード（% _）も除去する。
        // 除去しないと `%` 入力で全件マッチになり、意図しない広範な一致が起きる。
        const safeKeyword = filter.location.replace(/[,()*"%_]/g, '');
        const { data: matchedSites } = await supabase.from('dive_sites').select('id').ilike('name', `%${safeKeyword}%`);
        const siteIds = (matchedSites ?? []).map((site) => site.id);
        // ワイルドカードは * を使う
        const orParts = [`location.ilike.*${safeKeyword}*`];
        if (siteIds.length > 0) orParts.push(`dive_site_id.in.(${siteIds.join(',')})`);
        next = next.or(orParts.join(','));
    }
    // バディ絞り込み（spec 021 FR-022/023）: dive_log_buddies から該当 dive_id を引き、in で限定する。
    // 本人除去済み（removed_by_buddy=true）はヒットさせない。空集合なら 0 件に絞る。
    if (filter.buddyUserId) {
        const { data, error } = await supabase
            .from('dive_log_buddies')
            .select('dive_id')
            .eq('buddy_user_id', filter.buddyUserId)
            .eq('removed_by_buddy', false);
        // エラーを握りつぶすと 0 件（=該当なし）と区別できず誤表示になるため throw する
        if (error) throw new Error(`バディ絞り込みの取得に失敗しました: ${error.message}`);
        next = next.in(
            'id',
            (data ?? []).map((row) => row.dive_id),
        );
    }
    if (filter.buddyName) {
        const safeBuddy = filter.buddyName.replace(/[,()*"%_]/g, '');
        const { data, error } = await supabase
            .from('dive_log_buddies')
            .select('dive_id')
            .eq('removed_by_buddy', false)
            .ilike('buddy_name', `%${safeBuddy}%`);
        if (error) throw new Error(`バディ名絞り込みの取得に失敗しました: ${error.message}`);
        next = next.in(
            'id',
            (data ?? []).map((row) => row.dive_id),
        );
    }
    return { query: next };
};

export interface DiveListQueryOptions {
    filter?: DiveListFilter;
    cursor?: DiveCursor | null;
    limit?: number;
}

/**
 * 自分の dives を日付降順で取得する（サーバー・ブラウザ共用）。
 * キーセットページネーション（(dive_date, id) の複合カーソル）対応。
 * Supabase エラー時は throw する。
 */
export const fetchDiveListPage = async (
    supabase: SupabaseClient<Database>,
    options: DiveListQueryOptions = {},
): Promise<DiveListPage> => {
    const { filter, cursor, limit = DIVE_PAGE_SIZE } = options;

    // 一覧は本人のログのみ。公開読み取り RLS（authenticated can read public dives）により
    // 他人の公開ログが混ざらないよう、user_id を明示的に絞る（RLS 任せにしない二重防御）。
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { items: [], nextCursor: null };

    let query = supabase
        .from('dives')
        .select(DIVE_LIST_COLUMNS)
        .eq('user_id', user.id)
        .order('dive_date', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit + 1);

    query = (await applyDiveListFilter(supabase, query, filter)).query;

    if (cursor) {
        // クライアント由来のカーソルはフィルタ文字列へ補間するため、形式が不正なら空ページで打ち切る
        if (!isSafeKeysetCursor({ ...cursor })) return { items: [], nextCursor: null };
        /** (dive_date, id) の降順タプル比較を or で表現 */
        query = query.or(`dive_date.lt.${cursor.diveDate},and(dive_date.eq.${cursor.diveDate},id.lt.${cursor.id})`);
    }

    const { data, error } = await query;
    if (error || !data) {
        throw new Error(`dives の一覧取得に失敗しました: ${error?.message ?? 'no data'}`);
    }

    const rows = data as unknown as DiveListRow[];
    const hasNext = rows.length > limit;
    const items = (hasNext ? rows.slice(0, limit) : rows).map(mapDiveListItem);

    const last = items.at(-1);
    const nextCursor = hasNext && last ? { diveDate: last.diveDate, id: last.id } : null;

    return { items, nextCursor };
};
