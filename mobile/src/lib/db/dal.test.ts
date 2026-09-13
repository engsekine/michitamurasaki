import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';

import {
    countPending,
    deletePending,
    deleteUserData,
    getDiveById,
    getLastFullSyncAt,
    insertPendingDive,
    listDivesForDisplay,
    listPendingByStatus,
    replaceCachedDives,
    resetSyncingToPending,
    setLastFullSyncAt,
    updatePendingStatus,
    upsertCachedDives,
} from './dal';
import { migrate } from './schema';
import type { SqlDriver, SqlValue } from './types';

const USER_A = 'user-a';
const USER_B = 'user-b';

/** node:sqlite（実 SQLite）でドライバを実装し、DAL を実 SQL で検証する */
const makeDriver = (): SqlDriver => {
    const db = new DatabaseSync(':memory:');
    return {
        execute: async (sql: string, params: SqlValue[] = []) => {
            db.prepare(sql).run(...params);
        },
        query: async <T>(sql: string, params: SqlValue[] = []) => {
            return db.prepare(sql).all(...params) as T[];
        },
    };
};

let driver: SqlDriver;

const pendingInput = (id: string, diveDate: string, userId = USER_A) => ({
    id,
    userId,
    diveDate,
    payload: JSON.stringify({ diveDate, maxDepthM: 18 }),
    now: '2026-07-06T10:00:00.000Z',
});

beforeEach(async () => {
    driver = makeDriver();
    await migrate(driver);
});

describe('migrate', () => {
    it('再実行しても失敗しない（冪等）', async () => {
        await expect(migrate(driver)).resolves.not.toThrow();
    });
});

describe('pending_dives の CRUD と状態遷移', () => {
    it('作成した転送待ちログを pending として取得できる', async () => {
        await insertPendingDive(driver, pendingInput('p1', '2026-07-01'));

        const rows = await listPendingByStatus(driver, USER_A, 'pending');
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ id: 'p1', user_id: USER_A, status: 'pending', error_message: null });
    });

    it('状態を syncing → failed（理由付き）へ更新できる', async () => {
        await insertPendingDive(driver, pendingInput('p1', '2026-07-01'));

        await updatePendingStatus(driver, 'p1', 'syncing', { now: '2026-07-06T10:01:00.000Z' });
        await updatePendingStatus(driver, 'p1', 'failed', {
            now: '2026-07-06T10:02:00.000Z',
            errorMessage: 'permission denied',
        });

        const rows = await listPendingByStatus(driver, USER_A, 'failed');
        expect(rows[0]).toMatchObject({ status: 'failed', error_message: 'permission denied' });
    });

    it('転送完了で行を削除できる', async () => {
        await insertPendingDive(driver, pendingInput('p1', '2026-07-01'));
        await deletePending(driver, 'p1');

        expect(await countPending(driver, USER_A)).toBe(0);
    });

    it('起動時復旧: syncing 残留を pending に戻す（対象ユーザーのみ）', async () => {
        await insertPendingDive(driver, pendingInput('p1', '2026-07-01'));
        await insertPendingDive(driver, pendingInput('p2', '2026-07-02', USER_B));
        await updatePendingStatus(driver, 'p1', 'syncing', { now: '2026-07-06T10:01:00.000Z' });
        await updatePendingStatus(driver, 'p2', 'syncing', { now: '2026-07-06T10:01:00.000Z' });

        await resetSyncingToPending(driver, USER_A, '2026-07-06T10:05:00.000Z');

        expect(await listPendingByStatus(driver, USER_A, 'pending')).toHaveLength(1);
        expect(await listPendingByStatus(driver, USER_B, 'syncing')).toHaveLength(1);
    });

    it('countPending は pending と failed を未転送として数える', async () => {
        await insertPendingDive(driver, pendingInput('p1', '2026-07-01'));
        await insertPendingDive(driver, pendingInput('p2', '2026-07-02'));
        await updatePendingStatus(driver, 'p2', 'failed', { now: '2026-07-06T10:02:00.000Z', errorMessage: 'x' });

        expect(await countPending(driver, USER_A)).toBe(2);
    });
});

describe('cached_dives（サーバーコピー）', () => {
    const cached = (id: string, diveDate: string, userId = USER_A) => ({
        id,
        userId,
        diveDate,
        payload: JSON.stringify({ diveDate }),
        syncedAt: '2026-07-06T11:00:00.000Z',
    });

    it('upsert は同一 id を上書きする（機会的リフレッシュ / FR-012）', async () => {
        await upsertCachedDives(driver, [cached('c1', '2026-07-01')]);
        await upsertCachedDives(driver, [{ ...cached('c1', '2026-07-01'), payload: JSON.stringify({ v: 2 }) }]);

        const dive = await getDiveById(driver, USER_A, 'c1');
        expect(dive?.payload).toBe(JSON.stringify({ v: 2 }));
    });

    it('replaceCachedDives は該当ユーザーの全件を置換する（全件同期 / Web 側の削除も反映）', async () => {
        await upsertCachedDives(driver, [cached('c1', '2026-07-01'), cached('c2', '2026-07-02')]);
        await upsertCachedDives(driver, [cached('cb', '2026-07-03', USER_B)]);

        await replaceCachedDives(driver, USER_A, [cached('c3', '2026-07-04')]);

        expect(await getDiveById(driver, USER_A, 'c1')).toBeNull();
        expect(await getDiveById(driver, USER_A, 'c3')).not.toBeNull();
        // 他ユーザーのキャッシュは影響なし
        expect(await getDiveById(driver, USER_B, 'cb')).not.toBeNull();
    });
});

describe('listDivesForDisplay（cached ∪ pending の統合一覧）', () => {
    it('dive_date 降順で統合し、状態を区別できる（FR-014）', async () => {
        await upsertCachedDives(driver, [
            { id: 'c1', userId: USER_A, diveDate: '2026-07-01', payload: '{}', syncedAt: 't' },
        ]);
        await insertPendingDive(driver, pendingInput('p1', '2026-07-03'));
        await upsertCachedDives(driver, [
            { id: 'c2', userId: USER_A, diveDate: '2026-07-02', payload: '{}', syncedAt: 't' },
        ]);

        const rows = await listDivesForDisplay(driver, USER_A);

        expect(rows.map((row) => row.id)).toEqual(['p1', 'c2', 'c1']);
        expect(rows[0]?.status).toBe('pending');
        expect(rows[1]?.status).toBe('synced');
    });

    it('他ユーザーの行は含まれない（FR-019）', async () => {
        await insertPendingDive(driver, pendingInput('pb', '2026-07-01', USER_B));

        expect(await listDivesForDisplay(driver, USER_A)).toHaveLength(0);
    });
});

describe('sync_meta とユーザーデータ削除', () => {
    it('last_full_sync_at を保存・取得できる（未実行は null / FR-013）', async () => {
        expect(await getLastFullSyncAt(driver, USER_A)).toBeNull();

        await setLastFullSyncAt(driver, USER_A, '2026-07-06T12:00:00.000Z');
        expect(await getLastFullSyncAt(driver, USER_A)).toBe('2026-07-06T12:00:00.000Z');

        await setLastFullSyncAt(driver, USER_A, '2026-07-06T13:00:00.000Z');
        expect(await getLastFullSyncAt(driver, USER_A)).toBe('2026-07-06T13:00:00.000Z');
    });

    it('deleteUserData は該当ユーザーの pending / cached / meta をすべて消す（ログアウト時）', async () => {
        await insertPendingDive(driver, pendingInput('p1', '2026-07-01'));
        await upsertCachedDives(driver, [
            { id: 'c1', userId: USER_A, diveDate: '2026-07-01', payload: '{}', syncedAt: 't' },
        ]);
        await setLastFullSyncAt(driver, USER_A, 't');
        await insertPendingDive(driver, pendingInput('pb', '2026-07-02', USER_B));

        await deleteUserData(driver, USER_A);

        expect(await listDivesForDisplay(driver, USER_A)).toHaveLength(0);
        expect(await getLastFullSyncAt(driver, USER_A)).toBeNull();
        // 別ユーザーのデータは残る
        expect(await listDivesForDisplay(driver, USER_B)).toHaveLength(1);
    });
});
