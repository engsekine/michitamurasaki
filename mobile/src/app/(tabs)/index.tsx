import type { DiveInsertRow } from '@repo/core';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useSession } from '../../features/auth/useSession';
import { statusLabel, toDiveRecord } from '../../features/dives/lib/diveView';
import { SyncStatusBar } from '../../features/sync/components/SyncStatusBar';
import { retryAllFailed, type SyncProgress, subscribeSyncProgress } from '../../features/sync/engine';
import { fetchDivesPage } from '../../features/sync/fetchDivesPage';
import { getLastFullSyncAt, listDivesForDisplay, upsertCachedDives } from '../../lib/db/dal';
import { getDriver } from '../../lib/db/expoDriver';
import type { DiveListRow } from '../../lib/db/types';
import { colors, fontSize, MIN_TOUCH_TARGET, radius, spacing } from '../../theme/tokens';

interface ListItem {
    row: DiveListRow;
    record: DiveInsertRow | null;
}

/**
 * ログ一覧（US2 / FR-010・FR-014）。データ源は常に SQLite（cached ∪ pending）。
 * オンライン時は表示時に最新ページを機会的リフレッシュする（明示の全件同期は設定画面）。
 */
export default function DiveListScreen() {
    const router = useRouter();
    const { session } = useSession();
    const userId = session?.user.id ?? null;

    const [items, setItems] = useState<ListItem[]>([]);
    const [lastFullSyncAt, setLastFullSyncAt] = useState<string | null>(null);
    const [progress, setProgress] = useState<SyncProgress>({ phase: 'idle', total: 0, done: 0, lastError: null });

    const load = useCallback(async () => {
        if (!userId) return;
        const driver = await getDriver();
        const rows = await listDivesForDisplay(driver, userId);
        setItems(rows.map((row) => ({ row, record: toDiveRecord(row, userId) })));
        setLastFullSyncAt(await getLastFullSyncAt(driver, userId));
    }, [userId]);

    /** オンラインなら最新 50 件をキャッシュへ upsert（機会的リフレッシュ / FR-012。失敗は静かに無視） */
    const opportunisticRefresh = useCallback(async () => {
        if (!userId) return;
        try {
            const rows = await fetchDivesPage(userId, null, 50);
            const driver = await getDriver();
            await upsertCachedDives(
                driver,
                rows.map((row) => ({
                    id: row.id,
                    userId,
                    diveDate: row.dive_date,
                    payload: JSON.stringify(row),
                    syncedAt: new Date().toISOString(),
                })),
            );
            await load();
        } catch {
            // 圏外・サーバー障害時はキャッシュ表示のまま（オフラインファースト）
        }
    }, [userId, load]);

    useFocusEffect(
        useCallback(() => {
            void load().then(() => void opportunisticRefresh());
        }, [load, opportunisticRefresh]),
    );

    // 転送の進捗と完了（idle 復帰）で一覧を更新する
    useEffect(() => {
        return subscribeSyncProgress((next) => {
            setProgress(next);
            if (next.phase === 'idle') void load();
        });
    }, [load]);

    const pendingCount = items.filter((item) => item.row.status !== 'synced').length;
    const failedCount = items.filter((item) => item.row.status === 'failed').length;

    const emptyMessage =
        lastFullSyncAt === null
            ? 'まだ表示できるログがありません。オンラインで設定の「オフライン用に同期」を実行するか、「書く」からログを作成しましょう。'
            : 'ログがありません。「書く」から最初のログを作成しましょう。';

    return (
        <View style={styles.screen}>
            <SyncStatusBar
                pendingCount={pendingCount}
                failedCount={failedCount}
                progress={progress}
                onRetry={() => void retryAllFailed()}
            />
            <FlatList
                data={items}
                keyExtractor={(item) => item.row.id}
                contentContainerStyle={items.length === 0 ? styles.emptyContainer : styles.listContainer}
                ListEmptyComponent={<Text style={styles.empty}>{emptyMessage}</Text>}
                renderItem={({ item }) => {
                    const badge = statusLabel(item.row.status);
                    const record = item.record;
                    return (
                        <Pressable
                            onPress={() => router.push(`/dives/${item.row.id}`)}
                            accessibilityRole="button"
                            accessibilityLabel={`ログ ${record?.location ?? ''} ${item.row.dive_date}${badge ? `、${badge}` : ''}`}
                            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
                        >
                            <View style={styles.itemMain}>
                                <Text style={styles.itemTitle}>{record?.location ?? '（読み込めないログ）'}</Text>
                                <Text style={styles.itemSub}>
                                    {item.row.dive_date}
                                    {record ? ` ・ 最大 ${record.max_depth_m}m ・ ${record.bottom_time_min}分` : ''}
                                </Text>
                                {item.row.status === 'failed' && item.row.error_message && (
                                    <Text style={styles.itemError}>{item.row.error_message}</Text>
                                )}
                            </View>
                            {badge && (
                                <Text style={[styles.badge, item.row.status === 'failed' && styles.badgeFailed]}>
                                    {badge}
                                </Text>
                            )}
                        </Pressable>
                    );
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    listContainer: { padding: spacing.md, gap: spacing.sm },
    emptyContainer: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
    empty: { color: colors.mutedForeground, fontSize: fontSize.sm, textAlign: 'center', lineHeight: 22 },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        minHeight: MIN_TOUCH_TARGET + 16,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.lg,
        padding: spacing.md,
        backgroundColor: colors.background,
    },
    itemPressed: { backgroundColor: colors.muted },
    itemMain: { flex: 1, gap: 2 },
    itemTitle: { color: colors.foreground, fontSize: fontSize.base, fontWeight: '700' },
    itemSub: { color: colors.mutedForeground, fontSize: fontSize.sm },
    itemError: { color: colors.destructive, fontSize: fontSize.xs },
    badge: {
        color: colors.pending,
        backgroundColor: colors.pendingBg,
        borderRadius: radius.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        fontSize: fontSize.xs,
        fontWeight: '700',
        overflow: 'hidden',
    },
    badgeFailed: { color: colors.destructive, backgroundColor: '#fde8e8' },
});
