import { type DiveFormValues, type DiveInsertRow, toDiveInsertRow } from '@repo/core';

import type { DiveListRow } from '../../../lib/db/types';

/**
 * 端末内の 1 行（pending / cached）を表示用の snake_case レコードに正規化する。
 * - synced: サーバー行（または転送時の INSERT 行）の JSON をそのまま使う
 * - pending / failed 等: フォーム値（camelCase）を INSERT 行へ変換する
 * payload 破損時は null（表示側で「読み込めないログ」フォールバック）。
 */
export const toDiveRecord = (row: DiveListRow, userId: string): DiveInsertRow | null => {
    try {
        const payload = JSON.parse(row.payload) as unknown;
        if (row.status === 'synced') {
            return payload as DiveInsertRow;
        }
        return toDiveInsertRow(payload as DiveFormValues, { id: row.id, userId });
    } catch {
        return null;
    }
};

/** 一覧の状態バッジ文言（FR-014） */
export const statusLabel = (status: DiveListRow['status']): string | null => {
    switch (status) {
        case 'pending':
            return '転送待ち';
        case 'syncing':
            return '転送中';
        case 'failed':
            return '転送失敗';
        case 'synced':
            return null;
    }
};
