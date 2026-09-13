/**
 * SQLite ドライバの最小インターフェース。
 * 本番は expo-sqlite、テストは node:sqlite（Node 24 組み込み）で実装を差し替える。
 * DAL はこのインターフェースにのみ依存し、RN 非依存で Vitest 検証できる。
 */
export type SqlValue = string | number | null;

export interface SqlDriver {
    /** 結果を返さない文（DDL / INSERT / UPDATE / DELETE） */
    execute(sql: string, params?: SqlValue[]): Promise<void>;
    /** SELECT。行はカラム名キーのオブジェクト */
    query<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
}

/** pending_dives.status（data-model.md §2。synced は行削除 + cached 移動で表現） */
export type PendingStatus = 'pending' | 'syncing' | 'failed';

/** 転送待ちログの 1 行 */
export interface PendingDiveRow {
    id: string;
    user_id: string;
    dive_date: string;
    payload: string;
    status: PendingStatus;
    error_message: string | null;
    created_at: string;
    updated_at: string;
}

/** サーバーコピーの 1 行 */
export interface CachedDiveRow {
    id: string;
    user_id: string;
    dive_date: string;
    payload: string;
    synced_at: string;
}

/** 一覧表示用の統合行（cached ∪ pending / FR-014） */
export interface DiveListRow {
    id: string;
    dive_date: string;
    payload: string;
    /** synced = サーバー由来（cached）。それ以外は pending_dives.status */
    status: PendingStatus | 'synced';
    error_message: string | null;
}
