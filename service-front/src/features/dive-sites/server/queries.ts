import 'server-only';

import type { SiteStatsInput } from '@/features/dive-sites/lib/siteStats';
import type { DiveSite } from '@/features/dive-sites/types';
import { toNumber } from '@/shared/lib/number';
import { createClient } from '@/shared/lib/supabase/server';

/** 選択肢・表示に使う最小項目 */
export type DiveSiteSummary = Pick<DiveSite, 'id' | 'name' | 'area'>;

/**
 * 全ダイブサイト（共有マスタ）を取得する。エリア → 名称の昇順。
 * ログ作成・編集のサイト選択肢として、ページ層で `siteLabel` を使ってラベル化して使う。
 */
export const listDiveSites = async (): Promise<DiveSiteSummary[]> => {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('dive_sites')
        .select('id, name, area')
        .order('area', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true });

    if (error || !data) {
        throw new Error(`[listDiveSites] supabase error: ${error?.message ?? 'no data'}`);
    }

    return data.map((row) => ({ id: row.id, name: row.name, area: row.area }));
};

/** ダイブサイトを 1 件取得する。存在しなければ null */
export const getDiveSiteById = async (id: string): Promise<DiveSite | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('dive_sites')
        .select('id, name, area, country, description')
        .eq('id', id)
        .maybeSingle();

    if (error) {
        throw new Error(`[getDiveSiteById] supabase error: ${error.message}`);
    }
    if (!data) return null;

    return {
        id: data.id,
        name: data.name,
        area: data.area,
        country: data.country,
        description: data.description,
    };
};

/**
 * 本人の当該サイトのログ（実績集計用に潜水日・透明度のみ）を取得する。
 * RLS は他人の公開ログ（is_public）も可視にするため（021 の公開読み取りポリシー以降）、
 * user_id の明示条件で本人分に限定する。サイト別実績の算出元（calcSiteStats へ渡す）。
 */
export const listMyDivesForSite = async (siteId: string): Promise<SiteStatsInput[]> => {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('[listMyDivesForSite] not authenticated');

    const { data, error } = await supabase
        .from('dives')
        .select('dive_date, visibility_m')
        .eq('dive_site_id', siteId)
        .eq('user_id', user.id);

    if (error || !data) {
        throw new Error(`[listMyDivesForSite] supabase error: ${error?.message ?? 'no data'}`);
    }

    return data.map((row) => ({ diveDate: row.dive_date, visibilityM: toNumber(row.visibility_m) }));
};
