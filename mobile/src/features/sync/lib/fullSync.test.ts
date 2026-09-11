import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getDiveById, getLastFullSyncAt, upsertCachedDives } from '../../../lib/db/dal';
import { migrate } from '../../../lib/db/schema';
import type { SqlDriver, SqlValue } from '../../../lib/db/types';
import { runFullSync, type ServerDiveRow } from './fullSync';

const USER_ID = 'user-a';
const NOW = '2026-07-06T12:00:00.000Z';

const makeDriver = (): SqlDriver => {
    const db = new DatabaseSync(':memory:');
    return {
        execute: async (sql: string, params: SqlValue[] = []) => {
            db.prepare(sql).run(...params);
        },
        query: async <T>(sql: string, params: SqlValue[] = []) => db.prepare(sql).all(...params) as T[],
    };
};

const serverRow = (id: string, diveDate: string): ServerDiveRow => ({ id, dive_date: diveDate });

let driver: SqlDriver;

beforeEach(async () => {
    driver = makeDriver();
    await migrate(driver);
});

describe('runFullSync（全件同期 / FR-011-012・SC-004）', () => {
    it('keyset ページングで最後まで取得し、キャッシュを置換して last_full_sync_at を記録する', async () => {
        // 既存キャッシュ（Web 側で削除済みのログ想定）は置換で消える
        await upsertCachedDives(driver, [
            { id: 'stale', userId: USER_ID, diveDate: '2026-01-01', payload: '{}', syncedAt: 'old' },
        ]);

        const pages = [[serverRow('d3', '2026-07-03'), serverRow('d2', '2026-07-02')], [serverRow('d1', '2026-07-01')]];
        const fetchPage = vi.fn(async () => pages.shift() ?? []);

        const result = await runFullSync(driver, USER_ID, fetchPage, NOW, 2);

        expect(result.count).toBe(3);
        // 取得は必ず本人の userId で絞る（他人の公開ログを混入させない）
        expect(fetchPage).toHaveBeenNthCalledWith(1, USER_ID, null, 2);
        // 2 ページ目のカーソルは 1 ページ目の最終行
        expect(fetchPage).toHaveBeenNthCalledWith(2, USER_ID, { diveDate: '2026-07-02', id: 'd2' }, 2);
        expect(await getDiveById(driver, USER_ID, 'stale')).toBeNull();
        expect(await getDiveById(driver, USER_ID, 'd1')).not.toBeNull();
        expect(await getLastFullSyncAt(driver, USER_ID)).toBe(NOW);
    });

    it('ページサイズ未満で最初のページが返れば 1 回で完了する', async () => {
        const fetchPage = vi.fn(async () => [serverRow('d1', '2026-07-01')]);

        const result = await runFullSync(driver, USER_ID, fetchPage, NOW, 100);

        expect(result.count).toBe(1);
        expect(fetchPage).toHaveBeenCalledTimes(1);
    });

    it('途中で取得に失敗したら既存キャッシュを壊さない（置換しない・meta も更新しない）', async () => {
        await upsertCachedDives(driver, [
            { id: 'keep', userId: USER_ID, diveDate: '2026-01-01', payload: '{}', syncedAt: 'old' },
        ]);
        const fetchPage = vi
            .fn()
            .mockResolvedValueOnce([serverRow('d2', '2026-07-02'), serverRow('d1', '2026-07-01')])
            .mockRejectedValueOnce(new Error('network down'));

        await expect(runFullSync(driver, USER_ID, fetchPage, NOW, 2)).rejects.toThrow('network down');

        expect(await getDiveById(driver, USER_ID, 'keep')).not.toBeNull();
        expect(await getLastFullSyncAt(driver, USER_ID)).toBeNull();
    });
});
