import type { SqlDriver } from './types';

/**
 * 端末内 SQLite の DDL（specs/029 data-model.md §1）。
 * すべて if not exists で冪等（起動ごとに実行して良い）。
 * 注: 一覧の並び替えに使う dive_date は pending 側にも冗長化する（payload の JSON を SQL から参照しないため）。
 */
const DDL: string[] = [
    `create table if not exists pending_dives (
        id text primary key,
        user_id text not null,
        dive_date text not null,
        payload text not null,
        status text not null check (status in ('pending', 'syncing', 'failed')),
        error_message text,
        created_at text not null,
        updated_at text not null
    )`,
    `create index if not exists idx_pending_dives_user_status on pending_dives(user_id, status)`,
    `create table if not exists cached_dives (
        id text primary key,
        user_id text not null,
        dive_date text not null,
        payload text not null,
        synced_at text not null
    )`,
    `create index if not exists idx_cached_dives_user_date on cached_dives(user_id, dive_date desc, id desc)`,
    `create table if not exists sync_meta (
        user_id text primary key,
        last_full_sync_at text
    )`,
];

/** 起動時マイグレーション（冪等） */
export const migrate = async (driver: SqlDriver): Promise<void> => {
    for (const sql of DDL) {
        await driver.execute(sql);
    }
};
