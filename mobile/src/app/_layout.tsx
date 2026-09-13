import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { startSyncTriggers } from '../features/sync/triggers';
import { colors } from '../theme/tokens';

/**
 * ルートレイアウト。認証の出し分けは (auth) / (tabs) の各レイアウトが担い、
 * ここでは同期エンジンのトリガー起動（フォアグラウンド復帰・通信回復）だけを行う。
 */
export default function RootLayout() {
    useEffect(() => {
        const stop = startSyncTriggers();
        return stop;
    }, []);

    return (
        <Stack
            screenOptions={{
                headerTintColor: colors.foreground,
                headerStyle: { backgroundColor: colors.background },
                contentStyle: { backgroundColor: colors.background },
            }}
        >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)/login" options={{ title: 'ログイン', headerShown: false }} />
            <Stack.Screen name="dives/[id]" options={{ title: 'ログ詳細' }} />
        </Stack>
    );
}
