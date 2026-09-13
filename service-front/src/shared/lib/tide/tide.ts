/** 潮回りの 5 区分 */
export type TidePhase = 'spring' | 'middle' | 'neap' | 'long' | 'young';

/** 潮回りの値 → 表示ラベル */
export const TIDE_PHASE_LABELS: Record<TidePhase, string> = {
    spring: '大潮',
    middle: '中潮',
    neap: '小潮',
    long: '長潮',
    young: '若潮',
};

/** 平均朔望月（日）。真の朔望とは最大 1 日程度ずれうる近似値として扱う */
const SYNODIC_MONTH_DAYS = 29.530588853;

/** 基準朔: 2000-01-06 18:14 UTC の新月 */
const EPOCH_NEW_MOON_MS = Date.parse('2000-01-06T18:14:00Z');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * 旧暦日相当（= 配列 index + 1）→ 潮名。釣り暦・潮見表で一般的な伝統的区分。
 * 「小潮 → 長潮 → 若潮 → 中潮」の並びが 1 周期に 2 回現れる 30 日で循環する。
 */
const LUNAR_DAY_TIDE_PHASES: readonly TidePhase[] = [
    'spring',
    'spring',
    'spring',
    'middle',
    'middle',
    'middle',
    'neap',
    'neap',
    'neap',
    'long',
    'young',
    'middle',
    'middle',
    'middle',
    'spring',
    'spring',
    'spring',
    'spring',
    'middle',
    'middle',
    'middle',
    'neap',
    'neap',
    'neap',
    'long',
    'young',
    'middle',
    'middle',
    'middle',
    'spring',
];

/**
 * 日付（YYYY-MM-DD）から潮回りを返す純粋関数。
 *
 * 月齢は対象日の JST 正午（= UTC 03:00）時点で評価し、現在時刻に依存しない
 * 決定的な計算とする。基準朔からの経過日数が負（基準朔より過去の日付）でも
 * 周期を加算して 0〜朔望月 の範囲に正規化する。
 * 形式不正・解釈不能な日付は null を返す（呼び出し側は潮回りを表示しない）。
 */
export const getTidePhase = (date: string): TidePhase | null => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

    const jstNoonMs = Date.parse(`${date}T03:00:00Z`);
    if (Number.isNaN(jstNoonMs)) return null;
    // 2026-02-30 のような存在しない日付は翌月に繰り上げて解釈されるため、往復比較で弾く
    if (!new Date(jstNoonMs).toISOString().startsWith(date)) return null;

    const daysSinceEpoch = (jstNoonMs - EPOCH_NEW_MOON_MS) / MS_PER_DAY;
    const moonAge = ((daysSinceEpoch % SYNODIC_MONTH_DAYS) + SYNODIC_MONTH_DAYS) % SYNODIC_MONTH_DAYS;

    // moonAge は [0, 朔望月) に正規化済みのため index は常に 0〜29 に収まる
    return LUNAR_DAY_TIDE_PHASES[Math.floor(moonAge)] ?? null;
};
