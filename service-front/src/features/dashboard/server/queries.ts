import 'server-only';

import { calcBlankDays } from '@/features/dashboard/lib/blankDays';
import { calcOverhaulStatus } from '@/features/dashboard/lib/overhaul';
import { fillMonthlyGaps, fillYearlyGaps } from '@/features/dashboard/lib/trends';
import type {
    DashboardHeroData,
    DiveStats,
    MonthlyDiveStat,
    PrimaryRegulatorStatus,
    YearlyDiveCount,
} from '@/features/dashboard/types';
import { todayInJst } from '@/shared/lib/date';
import { toNumber } from '@/shared/lib/number';
import { createClient } from '@/shared/lib/supabase/server';

/** 月別推移の対象期間（直近 12 ヶ月 — spec Assumptions） */
const MONTHLY_TREND_MONTHS = 12;

/** 累計統計を DB 側集計（RPC get_dive_stats）で取得する（FR-003） */
export const getDiveStats = async (): Promise<DiveStats> => {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('get_dive_stats').single();

    if (error || !data) {
        throw new Error(`[getDiveStats] supabase error: ${error?.message ?? 'no data'}`);
    }

    return {
        totalDives: Number(data.total_dives),
        totalBottomTimeMin: Number(data.total_bottom_time_min),
        maxDepthM: toNumber(data.max_depth_m) ?? 0,
        visitedLocations: Number(data.visited_locations),
    };
};

/**
 * 年別の本数推移を DB 側集計（RPC get_dive_yearly_counts）で取得する（FR-001）。
 * 歯抜け年は 0 本で補完済み。ログ 0 件は []（空状態の判定値 — research.md R-006）。
 */
export const getYearlyDiveCounts = async (): Promise<YearlyDiveCount[]> => {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('get_dive_yearly_counts');

    if (error || !data) {
        throw new Error(`[getYearlyDiveCounts] supabase error: ${error?.message ?? 'no data'}`);
    }

    return fillYearlyGaps(
        data.map((row) => ({
            year: Number(row.year),
            diveCount: Number(row.dive_count),
        })),
    );
};

/**
 * 直近 12 ヶ月の月別ダイビング本数を取得する（FR-002）。
 * データのない月は 0 本で補完し、ログの有無に関わらず常に 12 要素を返す。
 */
export const getMonthlyDiveStats = async (): Promise<MonthlyDiveStat[]> => {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('get_dive_monthly_stats', { months_back: MONTHLY_TREND_MONTHS });

    if (error || !data) {
        throw new Error(`[getMonthlyDiveStats] supabase error: ${error?.message ?? 'no data'}`);
    }

    const baseMonth = todayInJst().slice(0, 7);

    return fillMonthlyGaps(
        data.map((row) => ({
            month: row.month,
            diveCount: Number(row.dive_count),
        })),
        baseMonth,
        MONTHLY_TREND_MONTHS,
    );
};

/**
 * メイン機材（is_primary = true）の OH ステータスを取得する（FR-012 / FR-014）。
 * レギュレーター未登録は null（TOP 側で登録 CTA を表示）。
 */
export const getPrimaryRegulatorStatus = async (): Promise<PrimaryRegulatorStatus | null> => {
    const supabase = await createClient();

    const { data: regulator, error } = await supabase
        .from('regulators')
        .select('id, brand, model, last_overhauled_on, overhaul_interval_months, overhaul_interval_dives')
        .eq('is_primary', true)
        .maybeSingle();

    if (error) {
        throw new Error(`[getPrimaryRegulatorStatus] supabase error: ${error.message}`);
    }
    if (!regulator) return null;

    // 公開読み取り RLS で他人の公開ログを数えないよう本人に限定する
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { count, error: countError } = await supabase
        .from('dives')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('dive_date', regulator.last_overhauled_on);

    if (countError) {
        throw new Error(`[getPrimaryRegulatorStatus] supabase error: ${countError.message}`);
    }

    const status = calcOverhaulStatus({
        lastOverhauledOn: regulator.last_overhauled_on,
        intervalMonths: regulator.overhaul_interval_months,
        intervalDives: regulator.overhaul_interval_dives,
        divesSinceLastOverhaul: count ?? 0,
        today: todayInJst(),
    });

    return {
        regulatorId: regulator.id,
        brand: regulator.brand,
        model: regulator.model,
        lastOverhauledOn: regulator.last_overhauled_on,
        status,
    };
};

/** ヒーロー用データ（表示名 + ブランク日数）を取得する（FR-002） */
export const getDashboardHero = async (): Promise<DashboardHeroData> => {
    const supabase = await createClient();

    // 最終ダイブ日は本人のログから求める。公開読み取り RLS で他人の公開ログを拾わないよう user_id で絞る
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const [detailsResult, lastDiveResult] = await Promise.all([
        supabase.from('user_details').select('nickname').maybeSingle(),
        supabase
            .from('dives')
            .select('dive_date')
            .eq('user_id', user?.id ?? '')
            .order('dive_date', { ascending: false })
            .limit(1)
            .maybeSingle(),
    ]);

    if (detailsResult.error) {
        throw new Error(`[getDashboardHero] supabase error: ${detailsResult.error.message}`);
    }
    if (lastDiveResult.error) {
        throw new Error(`[getDashboardHero] supabase error: ${lastDiveResult.error.message}`);
    }

    const lastDiveOn = lastDiveResult.data?.dive_date ?? null;

    return {
        nickname: detailsResult.data?.nickname ?? null,
        blankDays: calcBlankDays(lastDiveOn, todayInJst()),
        lastDiveOn,
    };
};
