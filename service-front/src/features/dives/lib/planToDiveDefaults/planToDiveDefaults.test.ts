import { planToDiveDefaults } from './planToDiveDefaults';

describe('planToDiveDefaults', () => {
    it('予定日・ポイント名・メモを初期値へ引き継ぐ', () => {
        const result = planToDiveDefaults({
            plannedOn: '2026-06-30',
            location: '伊豆 / 大瀬崎',
            notes: '外洋狙い',
        });
        expect(result.diveDate).toBe('2026-06-30');
        expect(result.location).toBe('伊豆 / 大瀬崎');
        expect(result.notes).toBe('外洋狙い');
    });

    it('メモが null のときは null のまま引き継ぐ', () => {
        const result = planToDiveDefaults({ plannedOn: '2026-06-30', location: '串本', notes: null });
        expect(result.notes).toBeNull();
    });

    it('予定に紐付けたショップを初期値へ引き継ぐ（033）', () => {
        const result = planToDiveDefaults({
            plannedOn: '2026-06-30',
            location: '串本',
            notes: null,
            diveShopId: 'shop-1',
        });
        expect(result.diveShopId).toBe('shop-1');
    });

    it('diveSiteId は設定しない（location と排他の制約を満たす）', () => {
        const result = planToDiveDefaults({ plannedOn: '2026-06-30', location: '串本', notes: null });
        expect(result.diveSiteId).toBeUndefined();
    });

    it('必須の最大水深・潜水時間は含めない（ユーザー入力に委ねる / FR-006）', () => {
        const result = planToDiveDefaults({ plannedOn: '2026-06-30', location: '串本', notes: null });
        expect(result.maxDepthM).toBeUndefined();
        expect(result.bottomTimeMin).toBeUndefined();
    });

    it('上限長のメモ（2000 文字）はそのまま引き継ぐ（上限一致で切り詰め不要 / FR-008 design-covered）', () => {
        const longNotes = 'あ'.repeat(2000);
        const result = planToDiveDefaults({ plannedOn: '2026-06-30', location: '串本', notes: longNotes });
        expect(result.notes).toBe(longNotes);
        expect(result.notes?.length).toBe(2000);
    });
});
