import type { DiveInsertRow } from '@repo/core';
import { TANK_TYPE_LABEL_MAP, type TankTypeValue } from '@repo/core';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useSession } from '../../features/auth/useSession';
import { statusLabel, toDiveRecord } from '../../features/dives/lib/diveView';
import { getDiveById } from '../../lib/db/dal';
import { getDriver } from '../../lib/db/expoDriver';
import type { DiveListRow } from '../../lib/db/types';
import { colors, fontSize, radius, spacing } from '../../theme/tokens';

const Field = ({ label, value }: { label: string; value: string | number | null | undefined }) => (
    <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{value === null || value === undefined || value === '' ? '—' : value}</Text>
    </View>
);

/**
 * ログ詳細（US2 / FR-010-011）。cached / pending どちらの由来でも同一レイアウト。
 * 未転送は「未転送・編集不可」を明示（FR-009/014）。編集・削除は第 1 段階では Web へ誘導。
 */
export default function DiveDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { session } = useSession();
    const [row, setRow] = useState<DiveListRow | null>(null);
    const [record, setRecord] = useState<DiveInsertRow | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const userId = session?.user.id;
        if (!userId || !id) return;
        (async () => {
            const driver = await getDriver();
            const found = await getDiveById(driver, userId, id);
            setRow(found);
            setRecord(found ? toDiveRecord(found, userId) : null);
            setIsLoading(false);
        })();
    }, [session, id]);

    if (isLoading) return null;
    if (!row || !record) {
        return (
            <View style={styles.center}>
                <Text style={styles.notFound}>
                    このログは端末にありません。オンラインで設定の「オフライン用に同期」を実行してください。
                </Text>
            </View>
        );
    }

    const badge = statusLabel(row.status);

    return (
        <ScrollView contentContainerStyle={styles.container}>
            {badge && (
                <View style={styles.pendingNote}>
                    <Text style={styles.pendingNoteText}>
                        {badge}のログです。転送が完了するまで編集できません。
                        {row.status === 'failed' && row.error_message ? `\n失敗理由: ${row.error_message}` : ''}
                    </Text>
                </View>
            )}

            <Text accessibilityRole="header" style={styles.title}>
                {record.location ?? '（ポイント未設定）'}
            </Text>
            <Text style={styles.subtitle}>{record.dive_date}</Text>

            <View style={styles.card}>
                <Field label="最大水深" value={`${record.max_depth_m} m`} />
                <Field label="平均水深" value={record.avg_depth_m === null ? null : `${record.avg_depth_m} m`} />
                <Field label="潜水時間" value={`${record.bottom_time_min} 分`} />
                <Field label="エントリー" value={record.entry_time} />
                <Field label="エキジット" value={record.exit_time} />
                <Field label="ダイブ番号" value={record.dive_number} />
                <Field label="ダイブタイプ" value={record.dive_type} />
            </View>

            <View style={styles.card}>
                <Field label="天候" value={record.weather} />
                <Field label="気温" value={record.air_temp_c === null ? null : `${record.air_temp_c} ℃`} />
                <Field label="水温" value={record.water_temp_c === null ? null : `${record.water_temp_c} ℃`} />
                <Field label="透明度" value={record.visibility_m === null ? null : `${record.visibility_m} m`} />
                <Field label="波" value={record.wave} />
                <Field label="流れ" value={record.current_condition} />
            </View>

            <View style={styles.card}>
                <Field
                    label="タンク"
                    value={
                        record.tank_type
                            ? (TANK_TYPE_LABEL_MAP[record.tank_type as TankTypeValue] ?? record.tank_type)
                            : null
                    }
                />
                <Field label="タンク容量" value={record.tank_volume_l === null ? null : `${record.tank_volume_l} L`} />
                <Field label="ガス" value={record.gas_type} />
                <Field label="酸素濃度" value={record.o2_percent === null ? null : `${record.o2_percent} %`} />
                <Field
                    label="開始残圧"
                    value={record.pressure_start_bar === null ? null : `${record.pressure_start_bar} bar`}
                />
                <Field
                    label="終了残圧"
                    value={record.pressure_end_bar === null ? null : `${record.pressure_end_bar} bar`}
                />
                <Field label="ウェイト" value={record.weight_kg === null ? null : `${record.weight_kg} kg`} />
                <Field label="スーツ" value={record.suit_type} />
                <Field label="装備メモ" value={record.equipment_notes} />
            </View>

            <View style={styles.card}>
                <Field label="バディ" value={record.buddy_name} />
                <Field label="インストラクター" value={record.instructor_name} />
                <Field label="講習ダイブ" value={record.certification_dive ? 'はい' : 'いいえ'} />
                <Field label="公開" value={record.is_public ? '公開' : '非公開'} />
                <Field label="メモ・印象" value={record.notes} />
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { padding: spacing.md, gap: spacing.md, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.background },
    notFound: { color: colors.mutedForeground, fontSize: fontSize.sm, textAlign: 'center', lineHeight: 22 },
    pendingNote: { backgroundColor: colors.pendingBg, borderRadius: radius.md, padding: spacing.md },
    pendingNoteText: { color: colors.pending, fontSize: fontSize.sm, fontWeight: '600', lineHeight: 20 },
    title: { color: colors.foreground, fontSize: fontSize.xl, fontWeight: '700' },
    subtitle: { color: colors.mutedForeground, fontSize: fontSize.sm },
    card: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.lg,
        padding: spacing.md,
        gap: spacing.sm,
    },
    fieldRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
    fieldLabel: { color: colors.mutedForeground, fontSize: fontSize.sm },
    fieldValue: {
        color: colors.foreground,
        fontSize: fontSize.sm,
        fontWeight: '600',
        flexShrink: 1,
        textAlign: 'right',
    },
});
