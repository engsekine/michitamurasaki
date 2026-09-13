import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { executeLogout, planLogout } from '../../features/auth/lib/logout';
import { useSession } from '../../features/auth/useSession';
import { type ExportFormat, exportDives } from '../../features/export/exportDives';
import { fetchDivesPage } from '../../features/sync/fetchDivesPage';
import { runFullSync } from '../../features/sync/lib/fullSync';
import { countPending, deleteUserData, getLastFullSyncAt } from '../../lib/db/dal';
import { getDriver } from '../../lib/db/expoDriver';
import { supabase } from '../../lib/supabase/client';
import { colors, fontSize, MIN_TOUCH_TARGET, radius, spacing } from '../../theme/tokens';

const Button = ({
    label,
    onPress,
    variant = 'outline',
    disabled = false,
}: {
    label: string;
    onPress: () => void;
    variant?: 'outline' | 'destructive';
    disabled?: boolean;
}) => (
    <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        style={({ pressed }) => [
            styles.button,
            variant === 'destructive' && styles.buttonDestructive,
            (pressed || disabled) && styles.buttonPressed,
        ]}
    >
        <Text style={[styles.buttonText, variant === 'destructive' && styles.buttonTextDestructive]}>{label}</Text>
    </Pressable>
);

/** 設定タブ: 全件同期（US2）・エクスポート（US3）・ログアウト（FR-019） */
export default function SettingsScreen() {
    const { session } = useSession();
    const userId = session?.user.id ?? null;

    const [lastFullSyncAt, setLastFullSyncAt] = useState<string | null>(null);
    const [pendingCount, setPendingCount] = useState(0);
    const [status, setStatus] = useState<string | null>(null);
    const [isBusy, setIsBusy] = useState(false);

    const load = useCallback(async () => {
        if (!userId) return;
        const driver = await getDriver();
        setLastFullSyncAt(await getLastFullSyncAt(driver, userId));
        setPendingCount(await countPending(driver, userId));
    }, [userId]);

    useFocusEffect(
        useCallback(() => {
            void load();
        }, [load]),
    );

    const handleFullSync = async () => {
        if (!userId || isBusy) return;
        setIsBusy(true);
        setStatus('同期中...');
        try {
            const driver = await getDriver();
            const { count } = await runFullSync(driver, userId, fetchDivesPage, new Date().toISOString());
            setStatus(`同期が完了しました（${count} 件）。圏外でも全ログを閲覧できます`);
            await load();
        } catch {
            setStatus('同期に失敗しました。通信環境を確認して再度お試しください');
        } finally {
            setIsBusy(false);
        }
    };

    const handleExport = async (format: ExportFormat) => {
        if (isBusy) return;
        setIsBusy(true);
        setStatus(null);
        const result = await exportDives(format);
        if (!result.ok) setStatus(result.reason);
        setIsBusy(false);
    };

    const handleLogout = async () => {
        if (!userId) return;
        const driver = await getDriver();
        const plan = planLogout(await countPending(driver, userId));
        const doLogout = () =>
            void executeLogout({
                deleteUserData: () => deleteUserData(driver, userId),
                signOut: async () => {
                    await supabase.auth.signOut();
                },
            });
        if (plan.requiresConfirmation) {
            Alert.alert(
                '未転送のログがあります',
                `転送されていないログが ${plan.pendingCount} 件あります。ログアウトすると端末から削除され、復元できません。`,
                [
                    { text: 'キャンセル', style: 'cancel' },
                    { text: '削除してログアウト', style: 'destructive', onPress: doLogout },
                ],
            );
            return;
        }
        doLogout();
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.section}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>
                    オフライン閲覧
                </Text>
                <Text style={styles.description}>
                    自分の全ログを端末にダウンロードし、圏外でも閲覧できるようにします。
                    {'\n'}最終同期: {lastFullSyncAt ? new Date(lastFullSyncAt).toLocaleString('ja-JP') : '未実行'}
                </Text>
                <Button label="オフライン用に同期" onPress={() => void handleFullSync()} disabled={isBusy} />
            </View>

            <View style={styles.section}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>
                    エクスポート
                </Text>
                <Text style={styles.description}>
                    サーバー上のログをファイルとして書き出し、保存・共有できます。
                    {pendingCount > 0
                        ? `\n転送待ちの ${pendingCount} 件は含まれません（転送完了後に出力されます）。`
                        : ''}
                </Text>
                <Button label="CSV でエクスポート" onPress={() => void handleExport('csv')} disabled={isBusy} />
                <Button label="PDF でエクスポート" onPress={() => void handleExport('pdf')} disabled={isBusy} />
            </View>

            {status && (
                <Text accessibilityLiveRegion="polite" style={styles.status}>
                    {status}
                </Text>
            )}

            <View style={styles.section}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>
                    アカウント
                </Text>
                <Text style={styles.description}>{session?.user.email ?? ''}</Text>
                <Button label="ログアウト" variant="destructive" onPress={() => void handleLogout()} />
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { padding: spacing.md, gap: spacing.lg, backgroundColor: colors.background },
    section: { gap: spacing.sm },
    sectionTitle: { color: colors.foreground, fontSize: fontSize.lg, fontWeight: '700' },
    description: { color: colors.mutedForeground, fontSize: fontSize.sm, lineHeight: 20 },
    status: { color: colors.pending, fontSize: fontSize.sm, fontWeight: '600' },
    button: {
        minHeight: MIN_TOUCH_TARGET,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonDestructive: { borderColor: colors.destructive },
    buttonPressed: { opacity: 0.7 },
    buttonText: { color: colors.foreground, fontSize: fontSize.base, fontWeight: '600' },
    buttonTextDestructive: { color: colors.destructive },
});
