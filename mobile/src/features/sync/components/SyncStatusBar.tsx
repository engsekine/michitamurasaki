import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, MIN_TOUCH_TARGET, radius, spacing } from '../../../theme/tokens';
import type { SyncProgress } from '../engine';

interface SyncStatusBarProps {
    /** 未転送（pending + failed）件数 */
    pendingCount: number;
    failedCount: number;
    progress: SyncProgress;
    onRetry: () => void;
}

/**
 * 一覧上部の同期ステータス（FR-003 / SC-005）。
 * すべて転送済みなら何も表示しない。進捗は aria-live 相当（accessibilityLiveRegion）で通知する。
 */
export const SyncStatusBar = ({ pendingCount, failedCount, progress, onRetry }: SyncStatusBarProps) => {
    if (pendingCount === 0 && progress.phase !== 'running') return null;

    const message =
        progress.phase === 'running'
            ? `転送中... ${progress.done} / ${progress.total} 件`
            : progress.phase === 'auth-required'
              ? `転送待ち ${pendingCount} 件（転送には再ログインが必要です）`
              : failedCount > 0
                ? `転送待ち ${pendingCount} 件（うち失敗 ${failedCount} 件）`
                : `転送待ち ${pendingCount} 件（通信回復後に自動転送されます）`;

    return (
        <View style={styles.bar} accessibilityLiveRegion="polite">
            <Text style={styles.text}>{message}</Text>
            {failedCount > 0 && progress.phase !== 'running' && (
                <Pressable
                    onPress={onRetry}
                    accessibilityRole="button"
                    accessibilityLabel="失敗したログを再転送"
                    style={styles.retryButton}
                >
                    <Text style={styles.retryText}>再転送</Text>
                </Pressable>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
        backgroundColor: colors.pendingBg,
        borderRadius: radius.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        margin: spacing.md,
        marginBottom: 0,
    },
    text: {
        flex: 1,
        color: colors.pending,
        fontSize: fontSize.sm,
        fontWeight: '600',
    },
    retryButton: {
        minHeight: MIN_TOUCH_TARGET - 8,
        justifyContent: 'center',
        paddingHorizontal: spacing.md,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: colors.pending,
    },
    retryText: {
        color: colors.pending,
        fontSize: fontSize.sm,
        fontWeight: '700',
    },
});
