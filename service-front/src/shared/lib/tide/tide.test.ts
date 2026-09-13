import { getTidePhase, TIDE_PHASE_LABELS, type TidePhase } from './tide';

/** data-model.md 4 節の基準日付。基準朔（2000-01-06T18:14Z）から導出される決定的な期待値 */
const FIXTURES: Array<[date: string, expected: TidePhase]> = [
    ['2000-01-07', 'spring'], // 基準朔の翌日（新月直後）→ 大潮
    ['2000-01-13', 'neap'], // 上弦付近 → 小潮
    ['2000-01-16', 'long'], // 長潮
    ['2000-01-17', 'young'], // 若潮
    ['2000-01-18', 'middle'], // 中潮
    ['2000-01-21', 'spring'], // 満月 → 大潮
    ['2000-01-28', 'neap'], // 下弦（対応表後半の旧暦 22 日）→ 小潮
    ['1999-12-25', 'spring'], // 基準朔より前（負の経過日数 → 周期加算で正規化）→ 大潮
];

/** 2000-01-07 から offset 日後の YYYY-MM-DD を返す */
const dateFromBase = (offsetDays: number): string =>
    new Date(Date.UTC(2000, 0, 7 + offsetDays)).toISOString().slice(0, 10);

describe('getTidePhase', () => {
    it.each(FIXTURES)('%s は %s を返す', (date, expected) => {
        expect(getTidePhase(date)).toBe(expected);
    });

    it('不正な入力には null を返す', () => {
        expect(getTidePhase('')).toBeNull();
        expect(getTidePhase('invalid')).toBeNull();
        expect(getTidePhase('2026-13-01')).toBeNull();
        expect(getTidePhase('2026-02-30')).toBeNull();
        expect(getTidePhase('2026/06/12')).toBeNull();
        expect(getTidePhase('20260612')).toBeNull();
    });

    it('連続 30 日で 5 区分すべてが「小潮 → 長潮 → 若潮 → 中潮」の循環順で出現する', () => {
        const phases = Array.from({ length: 30 }, (_, i) => getTidePhase(dateFromBase(i)));

        expect(new Set(phases).size).toBe(5);

        // 連続する重複を圧縮し、1 朔望周期の区分遷移を検証する
        const compressed = phases.filter((phase, i) => phase !== phases[i - 1]);
        expect(compressed).toEqual([
            'spring',
            'middle',
            'neap',
            'long',
            'young',
            'middle',
            'spring',
            'middle',
            'neap',
            'long',
            'young',
            'middle',
            'spring',
        ]);
    });

    it('同一入力に対して常に同一の結果を返す（決定的）', () => {
        const first = getTidePhase('2026-06-12');
        expect(first).not.toBeNull();
        expect(getTidePhase('2026-06-12')).toBe(first);
    });
});

describe('TIDE_PHASE_LABELS', () => {
    it('5 区分すべての日本語ラベルを持つ', () => {
        expect(TIDE_PHASE_LABELS).toEqual({
            spring: '大潮',
            middle: '中潮',
            neap: '小潮',
            long: '長潮',
            young: '若潮',
        });
    });
});
