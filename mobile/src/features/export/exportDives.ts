import * as FileSystem from 'expo-file-system/legacy';
import * as Network from 'expo-network';
import * as Sharing from 'expo-sharing';

import { supabase } from '../../lib/supabase/client';

export type ExportFormat = 'csv' | 'pdf';

export type ExportResult = { ok: true } | { ok: false; reason: string };

/**
 * ログのエクスポート（US3 / FR-015〜017・Clarification Q3）。
 * 既存 Web の GET /dives/export を Bearer トークンで呼び、生成物を共有シートへ渡す。
 * 対象はサーバー上のログのみ（転送待ちは含まれない = 呼び出し側で案内する）。
 */
export const exportDives = async (format: ExportFormat): Promise<ExportResult> => {
    const network = await Network.getNetworkStateAsync();
    if (!network.isConnected) {
        return { ok: false, reason: 'エクスポートには通信が必要です。オンラインで再度お試しください' };
    }

    const {
        data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
        return { ok: false, reason: 'エクスポートには再ログインが必要です' };
    }

    const siteUrl = process.env.EXPO_PUBLIC_SITE_URL ?? '';
    if (!siteUrl) {
        return { ok: false, reason: 'EXPO_PUBLIC_SITE_URL が未設定です' };
    }

    const target = `${FileSystem.cacheDirectory}dive-logs.${format}`;
    try {
        const result = await FileSystem.downloadAsync(`${siteUrl}/dives/export?format=${format}`, target, {
            headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (result.status !== 200) {
            return { ok: false, reason: `エクスポートに失敗しました（HTTP ${result.status}）` };
        }
        await Sharing.shareAsync(result.uri);
        return { ok: true };
    } catch {
        return { ok: false, reason: 'エクスポートに失敗しました。時間をおいて再度お試しください' };
    }
};
