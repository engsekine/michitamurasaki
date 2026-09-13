'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useController, useForm } from 'react-hook-form';

import { FormField } from '@/shared/components/form/FormField';
import { FormRadioGroup } from '@/shared/components/form/FormRadioGroup';
import { FormSelect } from '@/shared/components/form/FormSelect';
import { Heading } from '@/shared/components/typography/Heading';
import { Button } from '@/shared/components/ui/Button';

import {
    CONTACT_LENS_TYPE_OPTIONS,
    NEEDS_MASK_OPTIONS,
    SHEET_GENDER_OPTIONS,
    YES_NO_OPTIONS,
} from '../../../constants';
import { buildSheetText } from '../../../lib/buildSheetText';
import { applicationSheetSchema } from '../../../schemas/application-sheet.schema';
import { saveApplicationBaseProfile, saveApplicationSheet } from '../../../server/actions';
import type { SheetFormValues } from '../../../types';
import { RentalItemsField } from '../RentalItemsField';
import { SheetPreview } from '../SheetPreview';

interface ApplicationSheetFormProps {
    /** 自動入力・保存シートから組み立てた初期値（上書き修正可能・FR-008） */
    defaultValues?: Partial<SheetFormValues>;
    /** 開いている保存済みシートの ID（新規作成中は null / 未指定） */
    sheetId?: string | null;
    /** 開いている保存済みシートの名前 */
    initialSheetName?: string;
    /** 宛先ショップの選択肢（033）。page 側で features/shops から取得して注入する */
    shopOptions?: ReadonlyArray<{ id: string; name: string }>;
}

/**
 * 申し込みシート作成フォーム。入力のたびに buildSheetText でプレビューを更新する。
 * 全項目任意（FR-005）のため必須マークは付けない。
 * 保存はシート名付きのスナップショット（新規 or 開いているシートへの上書き・FR-010）。
 */
export const ApplicationSheetForm = ({
    defaultValues,
    sheetId,
    initialSheetName,
    shopOptions = [],
}: ApplicationSheetFormProps) => {
    const router = useRouter();
    const [isSaving, startSaving] = useTransition();
    const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle');
    const [serverError, setServerError] = useState<string | null>(null);
    const [sheetName, setSheetName] = useState(initialSheetName ?? '');
    const [isSavingBase, startSavingBase] = useTransition();
    const [baseSaveState, setBaseSaveState] = useState<'idle' | 'saved'>('idle');
    const [baseError, setBaseError] = useState<string | null>(null);
    // 新規保存に成功したら以降は同じシートへの上書きにする
    const [currentSheetId, setCurrentSheetId] = useState<string | null>(sheetId ?? null);

    const {
        register,
        control,
        watch,
        handleSubmit,
        formState: { errors },
    } = useForm<SheetFormValues>({
        resolver: yupResolver(applicationSheetSchema),
        defaultValues: { ...applicationSheetSchema.getDefault(), ...defaultValues },
        mode: 'onBlur',
    });

    const hasRentalField = useController({ control, name: 'hasRental' });
    const rentalItemsField = useController({ control, name: 'rentalItems' });
    const omitRentalBlockField = useController({ control, name: 'omitRentalBlock' });

    // 「無」を選んだら未該当ブロックの省略を既定で有効にする（FR-012。手動で解除可能）
    const handleHasRentalChange = (value: SheetFormValues['hasRental']) => {
        hasRentalField.field.onChange(value);
        if (value === 'no') omitRentalBlockField.field.onChange(true);
    };

    const formValues = watch();
    const sheetText = buildSheetText(formValues);

    const onSave = handleSubmit((values) => {
        setSaveState('idle');
        setServerError(null);
        startSaving(async () => {
            const result = await saveApplicationSheet({ sheetId: currentSheetId, name: sheetName, values });
            if (!result.success) {
                setServerError(result.error);
                return;
            }
            setCurrentSheetId(result.id);
            setSaveState('saved');
            // サーバーが持つ保存済みシート一覧を更新する
            router.refresh();
        });
    });

    // 基本情報だけを 1 ユーザー 1 件で保存する（新規シート作成時の自動入力に使う）
    const onSaveBaseProfile = handleSubmit((values) => {
        setBaseSaveState('idle');
        setBaseError(null);
        startSavingBase(async () => {
            const result = await saveApplicationBaseProfile(values);
            if (!result.success) {
                setBaseError(result.error);
                return;
            }
            setBaseSaveState('saved');
        });
    });

    return (
        <form
            className="flex flex-col gap-10"
            onSubmit={(event) => {
                void onSave(event);
            }}
            noValidate
        >
            <section className="flex flex-col gap-4">
                <Heading level={2}>基本情報</Heading>
                {/* 宛先ショップ（033 / FR-009）。シート保存のスナップショットに含まれ、開くと復元される。0 件時は登録導線を表示 */}
                {shopOptions.length > 0 ? (
                    <FormSelect
                        id="diveShopId"
                        label="宛先ショップ"
                        options={shopOptions.map((shop) => ({ value: shop.id, label: shop.name }))}
                        placeholder="選択しない"
                        error={errors.diveShopId?.message}
                        {...register('diveShopId')}
                    />
                ) : (
                    <p className="text-muted-foreground text-sm">
                        <Link href="/shops/new" className="text-primary underline">
                            ショップを登録
                        </Link>
                        すると宛先ショップを記録できます
                    </p>
                )}
                <FormField
                    id="fullName"
                    label="お名前"
                    type="text"
                    error={errors.fullName?.message}
                    {...register('fullName')}
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                        id="age"
                        label="年齢"
                        type="text"
                        inputMode="numeric"
                        error={errors.age?.message}
                        {...register('age')}
                    />
                    <FormField
                        id="birthOn"
                        label="生年月日"
                        type="date"
                        error={errors.birthOn?.message}
                        {...register('birthOn')}
                    />
                </div>
                <FormSelect
                    id="gender"
                    label="性別"
                    options={SHEET_GENDER_OPTIONS}
                    placeholder="選択してください"
                    error={errors.gender?.message}
                    {...register('gender')}
                />
                <FormField
                    id="phone"
                    label="携帯電話"
                    type="tel"
                    error={errors.phone?.message}
                    {...register('phone')}
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                        id="emergencyContactRelation"
                        label="緊急連絡先の続柄"
                        type="text"
                        placeholder="例: 父・妻"
                        error={errors.emergencyContactRelation?.message}
                        {...register('emergencyContactRelation')}
                    />
                    <FormField
                        id="emergencyContactPhone"
                        label="緊急連絡先の電話番号"
                        type="tel"
                        error={errors.emergencyContactPhone?.message}
                        {...register('emergencyContactPhone')}
                    />
                </div>
                <FormField
                    id="nearestStation"
                    label="最寄りの駅"
                    type="text"
                    error={errors.nearestStation?.message}
                    {...register('nearestStation')}
                />
                <FormField
                    id="licenseRank"
                    label="ライセンスランク"
                    type="text"
                    placeholder="例: Open Water Diver"
                    error={errors.licenseRank?.message}
                    {...register('licenseRank')}
                />
                <FormField
                    id="diveCount"
                    label="経験本数"
                    type="text"
                    inputMode="numeric"
                    error={errors.diveCount?.message}
                    {...register('diveCount')}
                />
                <FormField
                    id="lastDiveYearMonth"
                    label="最終ダイブ年月"
                    type="text"
                    placeholder="例: 2026年7月"
                    error={errors.lastDiveYearMonth?.message}
                    {...register('lastDiveYearMonth')}
                />
                <FormRadioGroup
                    legend="ドライスーツの経験"
                    {...register('hasDrySuitExperience')}
                    name="hasDrySuitExperience"
                    options={YES_NO_OPTIONS}
                    error={errors.hasDrySuitExperience?.message}
                />
                {formValues.hasDrySuitExperience === 'yes' && (
                    <FormField
                        id="drySuitDiveCount"
                        label="ドライスーツの経験本数"
                        type="text"
                        inputMode="numeric"
                        error={errors.drySuitDiveCount?.message}
                        {...register('drySuitDiveCount')}
                    />
                )}
                <div className="flex flex-col items-start gap-2">
                    <p className="text-muted-foreground text-sm">
                        基本情報を保存すると、新しいシートを作るときに自動で入力されます
                    </p>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={isSavingBase}
                        aria-busy={isSavingBase}
                        onClick={() => {
                            void onSaveBaseProfile();
                        }}
                    >
                        {isSavingBase ? '保存中...' : '基本情報を保存する'}
                    </Button>
                    {/* aria-live 領域は常設して更新を通知する */}
                    <span role="status" aria-live="polite" className="text-sky-700 text-sm">
                        {baseSaveState === 'saved' ? '基本情報を保存しました' : ''}
                    </span>
                    {baseError && (
                        <span role="alert" className="text-red-600 text-sm">
                            {baseError}
                        </span>
                    )}
                </div>
            </section>

            <section className="flex flex-col gap-4">
                <Heading level={2}>レンタル器材</Heading>
                <RentalItemsField
                    hasRental={hasRentalField.field.value}
                    onHasRentalChange={handleHasRentalChange}
                    selectedItems={rentalItemsField.field.value}
                    onSelectedItemsChange={rentalItemsField.field.onChange}
                    omitRentalBlock={omitRentalBlockField.field.value}
                    onOmitRentalBlockChange={omitRentalBlockField.field.onChange}
                />
                {/* レンタル「無」ではサイズ欄・コンタクトレンズ・度付きマスクの入力を求めない（FR-011） */}
                {hasRentalField.field.value !== 'no' && (
                    <>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <FormField
                                id="heightCm"
                                label="身長"
                                type="text"
                                inputMode="decimal"
                                placeholder="cm"
                                error={errors.heightCm?.message}
                                {...register('heightCm')}
                            />
                            <FormField
                                id="weightKg"
                                label="体重"
                                type="text"
                                inputMode="decimal"
                                placeholder="kg"
                                error={errors.weightKg?.message}
                                {...register('weightKg')}
                            />
                            <FormField
                                id="footSizeCm"
                                label="足のサイズ"
                                type="text"
                                inputMode="decimal"
                                placeholder="cm"
                                error={errors.footSizeCm?.message}
                                {...register('footSizeCm')}
                            />
                        </div>
                        <FormRadioGroup
                            legend="コンタクトレンズの有無"
                            {...register('hasContactLens')}
                            name="hasContactLens"
                            options={YES_NO_OPTIONS}
                            error={errors.hasContactLens?.message}
                        />
                        <FormSelect
                            id="contactLensType"
                            label="コンタクトレンズの種類"
                            options={CONTACT_LENS_TYPE_OPTIONS}
                            placeholder="選択してください"
                            error={errors.contactLensType?.message}
                            {...register('contactLensType')}
                        />
                        <FormRadioGroup
                            legend="度付きマスクレンタルの要否"
                            {...register('needsPrescriptionMask')}
                            name="needsPrescriptionMask"
                            options={NEEDS_MASK_OPTIONS}
                            error={errors.needsPrescriptionMask?.message}
                        />
                    </>
                )}
            </section>

            <section className="flex flex-col gap-4">
                <Heading level={2}>出力</Heading>
                <SheetPreview generatedText={sheetText} />
            </section>

            <section className="flex flex-col items-start gap-4">
                <Heading level={2}>シートの保存</Heading>
                <p className="text-muted-foreground text-sm">
                    シートは名前を付けて複数保存でき、次回から一覧で選んで再利用できます
                </p>
                <div className="w-full sm:max-w-sm">
                    <FormField
                        id="sheetName"
                        label="シート名"
                        name="sheetName"
                        type="text"
                        placeholder="例: 〇〇ショップ用"
                        value={sheetName}
                        onChange={(event) => setSheetName(event.target.value)}
                    />
                </div>
                <Button type="submit" variant="outline" disabled={isSaving} aria-busy={isSaving}>
                    {isSaving ? '保存中...' : currentSheetId ? '上書き保存する' : 'シートを保存する'}
                </Button>
                {/* aria-live 領域は常設して更新を通知する */}
                <span role="status" aria-live="polite" className="text-sky-700 text-sm">
                    {saveState === 'saved' ? '保存しました' : ''}
                </span>
                {serverError && (
                    <span role="alert" className="text-red-600 text-sm">
                        {serverError}
                    </span>
                )}
            </section>
        </form>
    );
};
