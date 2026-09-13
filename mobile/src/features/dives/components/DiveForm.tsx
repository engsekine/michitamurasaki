import { DIVE_TYPE_OPTIONS, diveSchema, GAS_TYPE_OPTIONS, TANK_TYPE_OPTIONS, todayInJst } from '@repo/core';
import * as Crypto from 'expo-crypto';
import { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from 'react-native';
import { ValidationError } from 'yup';

import { insertPendingDive } from '../../../lib/db/dal';
import { getDriver } from '../../../lib/db/expoDriver';
import { colors, fontSize, MIN_TOUCH_TARGET, radius, spacing } from '../../../theme/tokens';
import { runSyncQueue } from '../../sync/engine';

interface DiveFormProps {
    userId: string;
    /** 保存完了時（一覧へ戻る等）。保存はローカル書き込みのみで完了する（SC-001） */
    onSaved: () => void;
}

interface FieldConfig {
    key: string;
    label: string;
    keyboard?: 'numeric' | 'default';
    placeholder?: string;
}

/** セクションごとの入力項目（diveSchema の全項目 / FR-008。選択肢・スイッチは個別描画） */
const SECTIONS: Array<{ title: string; fields: FieldConfig[] }> = [
    {
        title: '基本情報',
        fields: [
            { key: 'diveDate', label: '潜水日（必須）', placeholder: 'YYYY-MM-DD' },
            { key: 'location', label: 'ポイント名（必須）', placeholder: '例: 伊豆 / 大瀬崎' },
            { key: 'maxDepthM', label: '最大水深 m（必須）', keyboard: 'numeric' },
            { key: 'bottomTimeMin', label: '潜水時間 分（必須）', keyboard: 'numeric' },
            { key: 'diveNumber', label: 'ダイブ番号', keyboard: 'numeric' },
            { key: 'entryTime', label: 'エントリー時刻', placeholder: 'HH:MM' },
            { key: 'exitTime', label: 'エキジット時刻', placeholder: 'HH:MM' },
            { key: 'avgDepthM', label: '平均水深 m', keyboard: 'numeric' },
        ],
    },
    {
        title: 'コンディション',
        fields: [
            { key: 'weather', label: '天候' },
            { key: 'airTempC', label: '気温 ℃', keyboard: 'numeric' },
            { key: 'waterTempC', label: '水温 ℃', keyboard: 'numeric' },
            { key: 'visibilityM', label: '透明度 m', keyboard: 'numeric' },
            { key: 'wave', label: '波' },
            { key: 'currentCondition', label: '流れ' },
        ],
    },
    {
        title: 'タンク・器材',
        fields: [
            { key: 'tankVolumeL', label: 'タンク容量 L', keyboard: 'numeric' },
            { key: 'o2Percent', label: '酸素濃度 %', keyboard: 'numeric' },
            { key: 'pressureStartBar', label: '開始残圧 bar', keyboard: 'numeric' },
            { key: 'pressureEndBar', label: '終了残圧 bar', keyboard: 'numeric' },
            { key: 'weightKg', label: 'ウェイト kg', keyboard: 'numeric' },
            { key: 'suitType', label: 'スーツ' },
            { key: 'equipmentNotes', label: '装備メモ' },
        ],
    },
    {
        title: 'メンバー・メモ',
        fields: [
            { key: 'buddyName', label: 'バディ名' },
            { key: 'instructorName', label: 'インストラクター名' },
            { key: 'notes', label: 'メモ・印象' },
        ],
    },
];

/** 選択チップ（ダイブタイプ / タンク / ガス） */
const ChipGroup = ({
    label,
    options,
    value,
    onChange,
}: {
    label: string;
    options: ReadonlyArray<{ value: string; label: string }>;
    value: string;
    onChange: (next: string) => void;
}) => (
    <View style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.chips}>
            {options.map((option) => {
                const selected = value === option.value;
                return (
                    <Pressable
                        key={option.value}
                        onPress={() => onChange(selected ? '' : option.value)}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`${label}: ${option.label}`}
                        style={[styles.chip, selected && styles.chipSelected]}
                    >
                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option.label}</Text>
                    </Pressable>
                );
            })}
        </View>
    </View>
);

/**
 * ログ作成フォーム（US1 / FR-001・FR-008）。
 * 入力検証は Web と同一の diveSchema（@repo/core）。保存は SQLite への書き込みのみで完了し、
 * 転送はバックグラウンドの同期エンジンに委ねる（オンラインなら即時転送 / FR-004）。
 */
export const DiveForm = ({ userId, onSaved }: DiveFormProps) => {
    const [values, setValues] = useState<Record<string, string>>({ diveDate: todayInJst() });
    const [certificationDive, setCertificationDive] = useState(false);
    const [isPublic, setIsPublic] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);

    const setField = (key: string, value: string) => setValues((prev) => ({ ...prev, [key]: value }));

    const handleSave = async () => {
        if (isSaving) return;
        setIsSaving(true);
        setErrors({});
        try {
            const casted = await diveSchema.validate(
                { ...values, certificationDive, isPublic, buddies: [] },
                { abortEarly: false, stripUnknown: true },
            );
            const driver = await getDriver();
            await insertPendingDive(driver, {
                id: Crypto.randomUUID(),
                userId,
                diveDate: casted.diveDate,
                payload: JSON.stringify(casted),
                now: new Date().toISOString(),
            });
            // オンラインなら即時転送を試みる（圏外なら次のトリガーまで転送待ちのまま）
            void runSyncQueue();
            onSaved();
        } catch (error) {
            if (error instanceof ValidationError) {
                const next: Record<string, string> = {};
                for (const inner of error.inner.length > 0 ? error.inner : [error]) {
                    if (inner.path && !next[inner.path]) next[inner.path] = inner.message;
                }
                setErrors(next);
            } else {
                setErrors({ _root: '保存に失敗しました。端末の空き容量を確認してください' });
            }
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                <Text style={styles.note}>圏外でも保存できます。保存したログは通信回復後に自動で転送されます。</Text>

                {SECTIONS.map((section) => (
                    <View key={section.title} style={styles.section}>
                        <Text accessibilityRole="header" style={styles.sectionTitle}>
                            {section.title}
                        </Text>
                        {section.title === '基本情報' && (
                            <ChipGroup
                                label="ダイブタイプ"
                                options={DIVE_TYPE_OPTIONS}
                                value={values.diveType ?? ''}
                                onChange={(next) => setField('diveType', next)}
                            />
                        )}
                        {section.title === 'タンク・器材' && (
                            <>
                                <ChipGroup
                                    label="タンク種別"
                                    options={TANK_TYPE_OPTIONS}
                                    value={values.tankType ?? 'steel'}
                                    onChange={(next) => setField('tankType', next)}
                                />
                                <ChipGroup
                                    label="ガス種別"
                                    options={GAS_TYPE_OPTIONS}
                                    value={values.gasType ?? 'air'}
                                    onChange={(next) => setField('gasType', next)}
                                />
                            </>
                        )}
                        {section.fields.map((field) => (
                            <View key={field.key} style={styles.field}>
                                <Text style={styles.label}>{field.label}</Text>
                                <TextInput
                                    value={values[field.key] ?? ''}
                                    onChangeText={(text) => setField(field.key, text)}
                                    keyboardType={field.keyboard === 'numeric' ? 'decimal-pad' : 'default'}
                                    placeholder={field.placeholder}
                                    placeholderTextColor={colors.mutedForeground}
                                    accessibilityLabel={field.label}
                                    style={[styles.input, errors[field.key] != null && styles.inputError]}
                                />
                                {errors[field.key] != null && (
                                    <Text accessibilityRole="alert" style={styles.error}>
                                        {errors[field.key]}
                                    </Text>
                                )}
                            </View>
                        ))}
                    </View>
                ))}

                <View style={styles.switchRow}>
                    <Text style={styles.label}>講習ダイブ</Text>
                    <Switch
                        value={certificationDive}
                        onValueChange={setCertificationDive}
                        accessibilityLabel="講習ダイブ"
                    />
                </View>
                <View style={styles.switchRow}>
                    <Text style={styles.label}>公開する</Text>
                    <Switch value={isPublic} onValueChange={setIsPublic} accessibilityLabel="公開する" />
                </View>

                {errors._root != null && (
                    <Text accessibilityRole="alert" style={styles.error}>
                        {errors._root}
                    </Text>
                )}

                <Pressable
                    onPress={handleSave}
                    disabled={isSaving}
                    accessibilityRole="button"
                    accessibilityLabel="ログを保存"
                    accessibilityState={{ disabled: isSaving, busy: isSaving }}
                    style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed]}
                >
                    <Text style={styles.saveButtonText}>{isSaving ? '保存中...' : 'ログを保存'}</Text>
                </Pressable>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    flex: { flex: 1 },
    container: { padding: spacing.md, paddingBottom: spacing.xl * 2, gap: spacing.md },
    note: {
        color: colors.mutedForeground,
        fontSize: fontSize.sm,
        backgroundColor: colors.muted,
        borderRadius: radius.md,
        padding: spacing.md,
    },
    section: { gap: spacing.sm },
    sectionTitle: { color: colors.foreground, fontSize: fontSize.lg, fontWeight: '700', marginTop: spacing.sm },
    field: { gap: spacing.xs },
    label: { color: colors.foreground, fontSize: fontSize.sm, fontWeight: '600' },
    input: {
        minHeight: MIN_TOUCH_TARGET,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        paddingHorizontal: spacing.md,
        color: colors.foreground,
        fontSize: fontSize.base,
        backgroundColor: colors.background,
    },
    inputError: { borderColor: colors.destructive },
    error: { color: colors.destructive, fontSize: fontSize.sm },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    chip: {
        minHeight: MIN_TOUCH_TARGET - 8,
        justifyContent: 'center',
        paddingHorizontal: spacing.md,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
    },
    chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { color: colors.mutedForeground, fontSize: fontSize.sm },
    chipTextSelected: { color: colors.primaryForeground, fontWeight: '700' },
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: MIN_TOUCH_TARGET,
    },
    saveButton: {
        minHeight: MIN_TOUCH_TARGET + 4,
        borderRadius: radius.md,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.md,
    },
    saveButtonPressed: { opacity: 0.85 },
    saveButtonText: { color: colors.primaryForeground, fontSize: fontSize.base, fontWeight: '700' },
});
