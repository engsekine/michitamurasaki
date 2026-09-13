import type { CachedDiveRow, DiveListRow, PendingDiveRow, PendingStatus, SqlDriver } from './types';

/**
 * 端末内 DB のデータアクセス層（specs/029 data-model.md）。
 * SqlDriver にのみ依存する純粋な関数群（本番 = expo-sqlite / テスト = node:sqlite）。
 * 日時はすべて呼び出し側から ISO 8601 文字列で渡す（テスト容易性のため Date.now を内包しない）。
 */

interface InsertPendingInput {
    id: string;
    userId: string;
    diveDate: string;
    payload: string;
    now: string;
}

/** 転送待ちログを作成する（オフライン保存 / FR-001-002） */
export const insertPendingDive = async (driver: SqlDriver, input: InsertPendingInput): Promise<void> => {
    await driver.execute(
        `insert into pending_dives (id, user_id, dive_date, payload, status, error_message, created_at, updated_at)
         values (?, ?, ?, ?, 'pending', null, ?, ?)`,
        [input.id, input.userId, input.diveDate, input.payload, input.now, input.now],
    );
};

/** 指定状態の転送待ちログを作成順で取得する */
export const listPendingByStatus = async (
    driver: SqlDriver,
    userId: string,
    status: PendingStatus,
): Promise<PendingDiveRow[]> => {
    return driver.query<PendingDiveRow>(
        `select * from pending_dives where user_id = ? and status = ? order by created_at asc, id asc`,
        [userId, status],
    );
};

/** 転送状態を更新する（FR-003） */
export const updatePendingStatus = async (
    driver: SqlDriver,
    id: string,
    status: PendingStatus,
    options: { now: string; errorMessage?: string },
): Promise<void> => {
    await driver.execute(`update pending_dives set status = ?, error_message = ?, updated_at = ? where id = ?`, [
        status,
        options.errorMessage ?? null,
        options.now,
        id,
    ]);
};

/** 転送完了した行を削除する（cached への移動とセットで使う） */
export const deletePending = async (driver: SqlDriver, id: string): Promise<void> => {
    await driver.execute(`delete from pending_dives where id = ?`, [id]);
};

/**
 * 起動時復旧: syncing のまま残った行を pending に戻す（強制終了対策 / SC-007）。
 * 転送は冪等（同一 UUID）なので、実際には送信済みでも再送して安全。
 */
export const resetSyncingToPending = async (driver: SqlDriver, userId: string, now: string): Promise<void> => {
    await driver.execute(
        `update pending_dives set status = 'pending', updated_at = ? where user_id = ? and status = 'syncing'`,
        [now, userId],
    );
};

/** 未転送（pending + failed）件数。バッジ・ログアウト警告に使う */
export const countPending = async (driver: SqlDriver, userId: string): Promise<number> => {
    const rows = await driver.query<{ cnt: number }>(`select count(*) as cnt from pending_dives where user_id = ?`, [
        userId,
    ]);
    return rows[0]?.cnt ?? 0;
};

interface CachedDiveInput {
    id: string;
    userId: string;
    diveDate: string;
    payload: string;
    syncedAt: string;
}

/** サーバーコピーを upsert する（転送完了・機会的リフレッシュ / FR-012） */
export const upsertCachedDives = async (driver: SqlDriver, dives: CachedDiveInput[]): Promise<void> => {
    for (const dive of dives) {
        await driver.execute(
            `insert into cached_dives (id, user_id, dive_date, payload, synced_at)
             values (?, ?, ?, ?, ?)
             on conflict(id) do update set
                 user_id = excluded.user_id,
                 dive_date = excluded.dive_date,
                 payload = excluded.payload,
                 synced_at = excluded.synced_at`,
            [dive.id, dive.userId, dive.diveDate, dive.payload, dive.syncedAt],
        );
    }
};

/** 全件同期: 該当ユーザーのキャッシュを丸ごと置換する（Web 側の削除も反映 / FR-011-012） */
export const replaceCachedDives = async (
    driver: SqlDriver,
    userId: string,
    dives: CachedDiveInput[],
): Promise<void> => {
    await driver.execute(`delete from cached_dives where user_id = ?`, [userId]);
    await upsertCachedDives(driver, dives);
};

/** 一覧表示用の統合ビュー: cached ∪ pending を dive_date 降順で返す（FR-014） */
export const listDivesForDisplay = async (driver: SqlDriver, userId: string): Promise<DiveListRow[]> => {
    return driver.query<DiveListRow>(
        `select id, dive_date, payload, status, error_message from pending_dives where user_id = ?
         union all
         select id, dive_date, payload, 'synced' as status, null as error_message from cached_dives where user_id = ?
         order by dive_date desc, id desc`,
        [userId, userId],
    );
};

/** 詳細表示用: pending / cached のどちらからでも 1 件引く */
export const getDiveById = async (driver: SqlDriver, userId: string, id: string): Promise<DiveListRow | null> => {
    const rows = await driver.query<DiveListRow>(
        `select id, dive_date, payload, status, error_message from pending_dives where user_id = ? and id = ?
         union all
         select id, dive_date, payload, 'synced' as status, null as error_message from cached_dives where user_id = ? and id = ?`,
        [userId, id, userId, id],
    );
    return rows[0] ?? null;
};

/** 最後に全件同期が完了した日時（null = 未実行 / FR-013 の案内判定） */
export const getLastFullSyncAt = async (driver: SqlDriver, userId: string): Promise<string | null> => {
    const rows = await driver.query<{ last_full_sync_at: string | null }>(
        `select last_full_sync_at from sync_meta where user_id = ?`,
        [userId],
    );
    return rows[0]?.last_full_sync_at ?? null;
};

export const setLastFullSyncAt = async (driver: SqlDriver, userId: string, syncedAt: string): Promise<void> => {
    await driver.execute(
        `insert into sync_meta (user_id, last_full_sync_at) values (?, ?)
         on conflict(user_id) do update set last_full_sync_at = excluded.last_full_sync_at`,
        [userId, syncedAt],
    );
};

/** ログアウト時のデータ削除（未転送の警告と確認は呼び出し側の責務 / FR-019） */
export const deleteUserData = async (driver: SqlDriver, userId: string): Promise<void> => {
    await driver.execute(`delete from pending_dives where user_id = ?`, [userId]);
    await driver.execute(`delete from cached_dives where user_id = ?`, [userId]);
    await driver.execute(`delete from sync_meta where user_id = ?`, [userId]);
};

export type { CachedDiveRow, DiveListRow, PendingDiveRow, PendingStatus };
