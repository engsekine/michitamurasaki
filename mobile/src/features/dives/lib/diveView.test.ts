import { describe, expect, it } from 'vitest';

import type { DiveListRow } from '../../../lib/db/types';
import { toDiveRecord } from './diveView';

const USER_ID = '11111111-1111-1111-1111-111111111111';

describe('toDiveRecord（一覧・詳細の表示用変換）', () => {
    it('synced（サーバー行の snake_case JSON）はそのまま返す', () => {
        const row: DiveListRow = {
            id: 'c1',
            dive_date: '2026-07-01',
            payload: JSON.stringify({ id: 'c1', dive_date: '2026-07-01', location: '大瀬崎', max_depth_m: 18.5 }),
            status: 'synced',
            error_message: null,
        };

        const record = toDiveRecord(row, USER_ID);

        expect(record).toMatchObject({ id: 'c1', dive_date: '2026-07-01', location: '大瀬崎', max_depth_m: 18.5 });
    });

    it('pending（フォーム値の camelCase JSON）は snake_case 行へ変換して返す', () => {
        const row: DiveListRow = {
            id: 'p1',
            dive_date: '2026-07-02',
            payload: JSON.stringify({
                diveDate: '2026-07-02',
                location: '住崎',
                maxDepthM: 24,
                bottomTimeMin: 42,
                certificationDive: false,
                isPublic: false,
            }),
            status: 'pending',
            error_message: null,
        };

        const record = toDiveRecord(row, USER_ID);

        expect(record).toMatchObject({
            id: 'p1',
            user_id: USER_ID,
            dive_date: '2026-07-02',
            location: '住崎',
            max_depth_m: 24,
            bottom_time_min: 42,
        });
    });

    it('payload が壊れている場合は null を返す（表示側でフォールバック）', () => {
        const row: DiveListRow = {
            id: 'x',
            dive_date: '2026-07-01',
            payload: '{broken',
            status: 'pending',
            error_message: null,
        };

        expect(toDiveRecord(row, USER_ID)).toBeNull();
    });
});
