import { describe, expect, it } from 'vitest';

import { diveSchema } from '../schemas/dive.schema';
import { toDiveInsertRow } from './diveTransfer';

const IDS = { id: 'dddddddd-0000-0000-0000-000000000001', userId: '11111111-1111-1111-1111-111111111111' };

/** フォーム入力 → スキーマ変換（cast）→ INSERT 行、の実経路で検証する */
const castValues = (input: Record<string, unknown>) => diveSchema.cast(input, { assert: false });

describe('toDiveInsertRow', () => {
    it('id / user_id は引数の値で固定される（クライアント採番 UUID = 冪等キー / FR-005）', () => {
        const values = castValues({ diveDate: '2026-07-01', maxDepthM: 18, bottomTimeMin: 40, location: '大瀬崎' });

        const row = toDiveInsertRow(values, IDS);

        expect(row.id).toBe(IDS.id);
        expect(row.user_id).toBe(IDS.userId);
    });

    it('camelCase の入力値を snake_case の列へ変換する', () => {
        const values = castValues({
            diveDate: '2026-07-01',
            maxDepthM: 18.5,
            bottomTimeMin: 40,
            location: '大瀬崎',
            diveNumber: 42,
            entryTime: '09:30',
            waterTempC: 24.5,
            pressureStartBar: 200,
            pressureEndBar: 60,
            certificationDive: true,
        });

        const row = toDiveInsertRow(values, IDS);

        expect(row).toMatchObject({
            dive_date: '2026-07-01',
            max_depth_m: 18.5,
            bottom_time_min: 40,
            location: '大瀬崎',
            dive_number: 42,
            entry_time: '09:30',
            water_temp_c: 24.5,
            pressure_start_bar: 200,
            pressure_end_bar: 60,
            certification_dive: true,
        });
    });

    it('未入力の任意項目は null になり、既定値（タンク等）はスキーマの値を引き継ぐ', () => {
        const values = castValues({ diveDate: '2026-07-01', maxDepthM: 18, bottomTimeMin: 40, location: '大瀬崎' });

        const row = toDiveInsertRow(values, IDS);

        expect(row.weather).toBeNull();
        expect(row.avg_depth_m).toBeNull();
        expect(row.notes).toBeNull();
        // スキーマ既定値
        expect(row.tank_type).toBe('steel');
        expect(row.tank_volume_l).toBe(10);
        expect(row.gas_type).toBe('air');
        expect(row.o2_percent).toBe(21);
        // 新規は既定で非公開（021 の既定と一致）
        expect(row.is_public).toBe(false);
    });

    it('buddies（登録ユーザーのタグ付け）は含めない（029 はソーシャルスコープ外・buddy_name のみ）', () => {
        const values = castValues({
            diveDate: '2026-07-01',
            maxDepthM: 18,
            bottomTimeMin: 40,
            location: '大瀬崎',
            buddyName: 'たろう',
            buddies: [{ name: 'はなこ' }],
        });

        const row = toDiveInsertRow(values, IDS);

        expect(row.buddy_name).toBe('たろう');
        expect('buddies' in row).toBe(false);
    });
});
