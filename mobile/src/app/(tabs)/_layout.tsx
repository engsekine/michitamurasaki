import { Redirect, Tabs } from 'expo-router';
import { type ColorValue, Text } from 'react-native';

import { useSession } from '../../features/auth/useSession';
import { colors } from '../../theme/tokens';

const tabIcon =
    (glyph: string) =>
    ({ color }: { color: ColorValue }) => (
        <Text accessible={false} style={{ color, fontSize: 20 }}>
            {glyph}
        </Text>
    );

/** 認証ゲート付きの下部タブ（contracts/app-screens.md）。未ログインはログインへ */
export default function TabsLayout() {
    const { session, isLoading } = useSession();

    if (isLoading) return null;
    if (!session) return <Redirect href="/login" />;

    return (
        <Tabs
            screenOptions={{
                headerTintColor: colors.foreground,
                headerStyle: { backgroundColor: colors.background },
                tabBarActiveTintColor: colors.foreground,
                tabBarInactiveTintColor: colors.mutedForeground,
                tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
                sceneStyle: { backgroundColor: colors.background },
            }}
        >
            <Tabs.Screen name="index" options={{ title: 'ログ', tabBarIcon: tabIcon('📖') }} />
            <Tabs.Screen name="new" options={{ title: '書く', tabBarIcon: tabIcon('✏️') }} />
            <Tabs.Screen name="settings" options={{ title: '設定', tabBarIcon: tabIcon('⚙️') }} />
        </Tabs>
    );
}
