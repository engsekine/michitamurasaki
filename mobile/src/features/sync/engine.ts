import { type DiveFormValues, toDiveInsertRow } from '@repo/core';

import {
    deletePending,
    listPendingByStatus,
    resetSyncingToPending,
    updatePendingStatus,
    upsertCachedDives,
} from '../../lib/db/dal';
import { getDriver } from '../../lib/db/expoDriver';
import { supabase } from '../../lib/supabase/client';
import { classifyTransferResult, pickNextTransfer } from './lib/syncMachine';

/** 同期の進捗（UI 表示用 / SC-005） */
export interface SyncProgress {
    phase: 'idle' | 'running' | 'auth-required';
    total: number;
    done: number;
    lastError: string | null;
}

type Listener = (progress: SyncProgress) => void;

const listeners = new Set<Listener>();
let current: SyncProgress = { phase: 'idle', total: 0, done: 0, lastError: null };
let isRunning = false;

const notify = (progress: SyncProgress) => {
    current = progress;
    for (const listener of listeners) listener(progress);
};

/** 進捗の購読（購読時に現在値を即時通知） */
export const subscribeSyncProgress = (listener: Listener): (() => void) => {
    listeners.add(listener);
    listener(current);
    return () => listeners.delete(listener);
};

/**
 * 転送キューの実行（contracts/sync-protocol.md）。
 * 1 件ずつ直列・シングルトン（実行中の再入はスキップ）。
 * セッションが無い/失効時はキューに触れず auth-required を通知する（FR-020）。
 */
export const runSyncQueue = async (): Promise<void> => {
    if (isRunning) return;
    isRunning = true;
    try {
        const driver = await getDriver();
        const {
            data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
            notify({ phase: 'auth-required', total: 0, done: 0, lastError: null });
            return;
        }
        const userId = session.user.id;

        // 強制終了で syncing のまま残った行を復旧（転送は冪等なので再送して安全 / SC-007）
        await resetSyncingToPending(driver, userId, new Date().toISOString());

        let pending = await listPendingByStatus(driver, userId, 'pending');
        const total = pending.length;
        let done = 0;
        let lastError: string | null = null;
        if (total > 0) notify({ phase: 'running', total, done, lastError });

        for (;;) {
            const action = pickNextTransfer(pending);
            if (action.type === 'done') break;
            const row = pending.find((r) => r.id === action.id);
            if (!row) break;
            pending = pending.filter((r) => r.id !== action.id);

            await updatePendingStatus(driver, row.id, 'syncing', { now: new Date().toISOString() });

            const values = JSON.parse(row.payload) as DiveFormValues;
            const insertRow = toDiveInsertRow(values, { id: row.id, userId });
            let result: {
                thrown: boolean;
                errorCode: string | null;
                errorMessage: string | null;
                errorDetails: string | null;
            };
            try {
                const { error } = await supabase.from('dives').insert(insertRow);
                result = {
                    thrown: false,
                    errorCode: error?.code ?? null,
                    errorMessage: error?.message ?? null,
                    errorDetails: error?.details ?? null,
                };
            } catch (exception) {
                result = { thrown: true, errorCode: null, errorMessage: String(exception), errorDetails: null };
            }

            const outcome = classifyTransferResult(result);
            if (outcome.kind === 'success') {
                // cached には表示用に snake_case 行（サーバー行と同形）で保存する
                await upsertCachedDives(driver, [
                    {
                        id: row.id,
                        userId,
                        diveDate: row.dive_date,
                        payload: JSON.stringify(insertRow),
                        syncedAt: new Date().toISOString(),
                    },
                ]);
                await deletePending(driver, row.id);
                done++;
                notify({ phase: 'running', total, done, lastError });
                continue;
            }
            if (outcome.kind === 'retry') {
                // 通信起因: pending に戻してエンジンを止め、次のトリガー（通信回復等）に委ねる
                await updatePendingStatus(driver, row.id, 'pending', { now: new Date().toISOString() });
                lastError = '通信できないため転送を中断しました';
                break;
            }
            // rejected: 理由を保存して次の行へ（手動再転送で復帰 / FR-006）
            await updatePendingStatus(driver, row.id, 'failed', {
                now: new Date().toISOString(),
                errorMessage: outcome.message,
            });
            lastError = outcome.message;
        }

        notify({ phase: 'idle', total, done, lastError });
    } finally {
        isRunning = false;
    }
};

/** 失敗したログの手動再転送（FR-006）。pending に戻してキューを起動する */
export const retryFailedDive = async (id: string): Promise<void> => {
    const driver = await getDriver();
    await updatePendingStatus(driver, id, 'pending', { now: new Date().toISOString() });
    void runSyncQueue();
};

/** 失敗ログの一括再転送（SyncStatusBar の「再転送」/ FR-006） */
export const retryAllFailed = async (): Promise<void> => {
    const driver = await getDriver();
    const {
        data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    const failed = await listPendingByStatus(driver, session.user.id, 'failed');
    for (const row of failed) {
        await updatePendingStatus(driver, row.id, 'pending', { now: new Date().toISOString() });
    }
    void runSyncQueue();
};
