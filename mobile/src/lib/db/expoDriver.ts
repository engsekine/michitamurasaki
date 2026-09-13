import * as SQLite from 'expo-sqlite';

import { migrate } from './schema';
import type { SqlDriver, SqlValue } from './types';

/** expo-sqlite を SqlDriver に適合させる本番ドライバ（テストは node:sqlite を使う） */
const wrap = (db: SQLite.SQLiteDatabase): SqlDriver => ({
    execute: async (sql: string, params: SqlValue[] = []) => {
        await db.runAsync(sql, params);
    },
    query: async <T>(sql: string, params: SqlValue[] = []) => {
        return (await db.getAllAsync(sql, params)) as T[];
    },
});

let driverPromise: Promise<SqlDriver> | null = null;

/** アプリ共有の SQLite ドライバ（初回にマイグレーションを実行） */
export const getDriver = (): Promise<SqlDriver> => {
    if (!driverPromise) {
        driverPromise = (async () => {
            const db = await SQLite.openDatabaseAsync('divelog.db');
            const driver = wrap(db);
            await migrate(driver);
            return driver;
        })();
    }
    return driverPromise;
};
