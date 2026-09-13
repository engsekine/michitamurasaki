import * as Network from 'expo-network';
import { AppState } from 'react-native';

import { runSyncQueue } from './engine';

/**
 * 自動転送のトリガー（Clarification Q1: フォアグラウンドのみ / research R8）。
 * ①起動直後 ②フォアグラウンド復帰 ③ネットワーク回復 で転送キューを起動する。
 * 手動再転送は SyncStatusBar のボタンから retryFailedDive / runSyncQueue を直接呼ぶ。
 */
export const startSyncTriggers = (): (() => void) => {
    // ① 起動直後
    void runSyncQueue();

    // ② フォアグラウンド復帰
    const appStateSubscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') void runSyncQueue();
    });

    // ③ ネットワーク回復
    const networkSubscription = Network.addNetworkStateListener((state) => {
        if (state.isConnected) void runSyncQueue();
    });

    return () => {
        appStateSubscription.remove();
        networkSubscription.remove();
    };
};
