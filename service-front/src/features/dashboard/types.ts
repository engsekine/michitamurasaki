import type { OverhaulStatus } from './lib/overhaul';

/** 累計統計（get_dive_stats RPC の結果） */
export interface DiveStats {
    totalDives: number;
    totalBottomTimeMin: number;
    maxDepthM: number;
    visitedLocations: number;
}

/** TOP ヒーロー用のデータ */
export interface DashboardHeroData {
    /** 表示名（user_details.nickname）。未設定は null */
    nickname: string | null;
    /** ブランク日数（最後に潜ってからの経過日数・最小 0）。ログ 0 件は null */
    blankDays: number | null;
    /** 最終潜水日（'YYYY-MM-DD'）。ログ 0 件は null */
    lastDiveOn: string | null;
}

/** FV に表示する次のダイビング予定（plans 機能のデータを app 層で変換して渡す） */
export interface HeroNextPlan {
    id: string;
    /** 'YYYY-MM-DD' */
    plannedOn: string;
    location: string;
    /** 今日 = 0、未来 = 正の値 */
    daysUntil: number;
}

/** メイン機材の OH ステータス（未登録は null を返す） */
export interface PrimaryRegulatorStatus {
    regulatorId: string;
    brand: string;
    model: string;
    lastOverhauledOn: string;
    status: OverhaulStatus;
}

/** TOP の最近のログ表示用（dives 機能の row を app 層で変換して渡す） */
export interface RecentDiveItem {
    id: string;
    diveDate: string;
    location: string;
    maxDepthM: number;
    bottomTimeMin: number;
    /** 代表写真（cover 優先）のサムネイル署名 URL。写真がなければ null（カード側でダミー画像にフォールバック） */
    coverThumbUrl: string | null;
}

/** 年別本数（get_dive_yearly_counts RPC + 歯抜け年 0 埋め後） */
export interface YearlyDiveCount {
    year: number;
    diveCount: number;
}

/** 月別統計（get_dive_monthly_stats RPC + 直近 12 ヶ月 0 埋め後） */
export interface MonthlyDiveStat {
    /** 'YYYY-MM' */
    month: string;
    diveCount: number;
}
