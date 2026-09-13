import { describe, expect, it } from 'vitest';

import { packingItemSchema, planSchema } from './plan.schema';

const validPlan = {
    plannedOn: '2026-07-01',
    location: '伊豆 / 大瀬崎',
    notes: '',
};

describe('planSchema', () => {
    it('有効な入力をパースできる（空メモは null になる）', async () => {
        const result = await planSchema.validate(validPlan);

        expect(result.plannedOn).toBe('2026-07-01');
        expect(result.location).toBe('伊豆 / 大瀬崎');
        expect(result.notes).toBeNull();
    });

    it('diveShopId は未選択（空文字・未指定）が null に正規化され、指定時はそのまま通る（033）', async () => {
        const unselected = await planSchema.validate({ ...validPlan, diveShopId: '' });
        expect(unselected.diveShopId).toBeNull();

        const omitted = await planSchema.validate(validPlan);
        expect(omitted.diveShopId).toBeNull();

        const selected = await planSchema.validate({ ...validPlan, diveShopId: 'shop-1' });
        expect(selected.diveShopId).toBe('shop-1');
    });

    it('diveShopId は未選択（空文字・未指定）が null に正規化され、指定時はそのまま通る（033）', async () => {
        const unselected = await planSchema.validate({ ...validPlan, diveShopId: '' });
        expect(unselected.diveShopId).toBeNull();

        const omitted = await planSchema.validate(validPlan);
        expect(omitted.diveShopId).toBeNull();

        const selected = await planSchema.validate({ ...validPlan, diveShopId: 'shop-1' });
        expect(selected.diveShopId).toBe('shop-1');
    });

    it('予定日が空だとエラーになる', async () => {
        await expect(planSchema.validate({ ...validPlan, plannedOn: '' })).rejects.toThrow('予定日を入力してください');
    });

    it('予定日が YYYY-MM-DD 形式でないとエラーになる', async () => {
        await expect(planSchema.validate({ ...validPlan, plannedOn: '2026/07/01' })).rejects.toThrow(
            '正しい日付を入力してください',
        );
    });

    it('実在しない日付はエラーになる', async () => {
        await expect(planSchema.validate({ ...validPlan, plannedOn: '2026-13-99' })).rejects.toThrow(
            '正しい日付を入力してください',
        );
    });

    it('過去日は許可される（終了済み予定として表示されるだけ）', async () => {
        const result = await planSchema.validate({ ...validPlan, plannedOn: '2020-01-01' });

        expect(result.plannedOn).toBe('2020-01-01');
    });

    it('ポイント名が空だとエラーになる', async () => {
        await expect(planSchema.validate({ ...validPlan, location: '  ' })).rejects.toThrow(
            'ポイント名を入力してください',
        );
    });

    it('ポイント名が 120 文字を超えるとエラーになる', async () => {
        await expect(planSchema.validate({ ...validPlan, location: 'あ'.repeat(121) })).rejects.toThrow(
            'ポイント名は120文字以内で入力してください',
        );
    });

    it('メモが 2000 文字を超えるとエラーになる', async () => {
        await expect(planSchema.validate({ ...validPlan, notes: 'あ'.repeat(2001) })).rejects.toThrow(
            'メモは2000文字以内で入力してください',
        );
    });

    it('メモは 2000 文字ちょうどまで許可される', async () => {
        const result = await planSchema.validate({ ...validPlan, notes: 'あ'.repeat(2000) });

        expect(result.notes).toHaveLength(2000);
    });
});

describe('packingItemSchema', () => {
    it('有効な項目名をパースできる', async () => {
        const result = await packingItemSchema.validate({ name: '酔い止め' });

        expect(result.name).toBe('酔い止め');
    });

    it('空の項目名はエラーになる', async () => {
        await expect(packingItemSchema.validate({ name: '  ' })).rejects.toThrow('項目名を入力してください');
    });

    it('項目名が 60 文字を超えるとエラーになる', async () => {
        await expect(packingItemSchema.validate({ name: 'あ'.repeat(61) })).rejects.toThrow(
            '項目名は60文字以内で入力してください',
        );
    });
});
