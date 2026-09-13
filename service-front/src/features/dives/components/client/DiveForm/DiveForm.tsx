'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import { XIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ChangeEvent, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { NoCreditBanner } from '@/features/credits/components/client/NoCreditBanner';
import { DIVE_TYPE_OPTIONS, GAS_TYPE_OPTIONS, TANK_TYPE_OPTIONS } from '@/features/dives/constants';
import { useDiveFormSubmit } from '@/features/dives/hooks/useDiveFormSubmit';
import { calcBottomTimeMin } from '@/features/dives/lib/calcBottomTime';
import { blockNonIntegerKeys, blurOnWheel } from '@/features/dives/lib/numericInput';
import { type PhotoFileMeta, photoValidationMessage, validateNewPhotos } from '@/features/dives/lib/photoValidation';
import { type DiveFormValues, diveSchema } from '@/features/dives/schemas/dive.schema';
import type { DivePhotoView } from '@/features/dives/types';
import { FormField, FormSelect, type FormSelectOption, FormTextarea, SearchSelect } from '@/shared/components/form';
import { PhotoThumbnail } from '@/shared/components/media/PhotoThumbnail';
import { Button } from '@/shared/components/ui/Button';
import { todayInJst } from '@/shared/lib/date';

import { DiveBuddyField } from '../DiveBuddyField';

interface DiveFormProps {
    /** 編集モードで指定。新規作成のときは undefined */
    diveId?: string;
    defaultValues?: Partial<DiveFormValues>;
    /** ダイブサイト選択肢（マスタ）。ページ層で listDiveSites + siteLabel から組み立てて渡す */
    siteOptions?: FormSelectOption[];
    /** 編集モードで表示する既存の添付写真。✕ でマークし、保存時にまとめて削除する */
    existingPhotos?: DivePhotoView[];
    /** 予定→ログ移動（024）のとき、移動元の予定 ID。保存成功時にその予定が削除される */
    fromPlanId?: string;
    /**
     * ログ枠の残数（026）。新規作成時にページ層が getCreditBalance() で渡す。
     * 0 のときは NoCreditBanner を先行表示する（サーバー側トリガーが最終判定）
     */
    creditBalance?: number;
    /** ショップ選択肢（033）。page 側で features/shops から取得して注入する（feature 間 import 禁止のため） */
    shopOptions?: ReadonlyArray<{ id: string; name: string }>;
}

const createDefaultValues = (overrides?: Partial<DiveFormValues>): DiveFormValues => ({
    diveNumber: null,
    diveDate: todayInJst(),
    entryTime: null,
    exitTime: null,
    location: '',
    diveSiteId: null,
    diveType: null,
    weather: null,
    airTempC: null,
    waterTempC: null,
    visibilityM: null,
    wave: null,
    currentCondition: null,
    maxDepthM: 1,
    avgDepthM: null,
    bottomTimeMin: 1,
    tankType: 'steel',
    tankVolumeL: 10,
    gasType: 'air',
    o2Percent: 21,
    pressureStartBar: null,
    pressureEndBar: null,
    weightKg: null,
    suitType: null,
    equipmentNotes: null,
    buddyName: null,
    instructorName: null,
    certificationDive: false,
    notes: null,
    buddies: [],
    isPublic: false,
    diveShopId: null,
    ...overrides,
});

export const DiveForm = ({
    diveId,
    defaultValues,
    siteOptions = [],
    existingPhotos = [],
    fromPlanId,
    creditBalance,
    shopOptions = [],
}: DiveFormProps) => {
    const router = useRouter();
    const isEdit = diveId !== undefined;

    const { isPending, serverError, serverWarning, noCredit, submit } = useDiveFormSubmit(diveId, fromPlanId);

    // 残枠 0 の案内（026 / FR-002）: ページ表示時点で 0、または送信が枠不足で拒否されたとき。
    // 編集は枠を消費しないため対象外（FR-010）。バナー表示中も入力値は保持される
    const showNoCreditBanner = !isEdit && (noCredit || creditBalance === 0);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = useForm<DiveFormValues>({
        resolver: yupResolver(diveSchema),
        defaultValues: createDefaultValues(defaultValues),
    });

    // 新規作成時のみ、写真を選択しておきログ保存後にまとめて添付する（FR-001 AC2）
    const [stagedPhotos, setStagedPhotos] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const [photoErrors, setPhotoErrors] = useState<string[]>([]);

    const handlePhotosChange = (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? []);
        const metas: PhotoFileMeta[] = files.map((file) => ({ name: file.name, size: file.size, type: file.type }));
        const validationErrors = validateNewPhotos(0, metas);
        if (validationErrors.length > 0) {
            setPhotoErrors(validationErrors.map(photoValidationMessage));
            setStagedPhotos([]);
            setPreviewUrls([]);
            return;
        }
        setPhotoErrors([]);
        setStagedPhotos(files);
        // 選択直後にプレビューを表示する（FR-001 補助）。object URL は下の effect で解放する
        setPreviewUrls(files.map((file) => URL.createObjectURL(file)));
    };

    // 選択写真のプレビュー用 object URL は不要になったら解放する（メモリリーク防止）
    useEffect(() => {
        return () => {
            for (const url of previewUrls) URL.revokeObjectURL(url);
        };
    }, [previewUrls]);

    // 編集モード: 既存写真の「削除予定」マーク。保存時にまとめて削除する（FR-013）
    const [photoIdsToDelete, setPhotoIdsToDelete] = useState<string[]>([]);
    const togglePhotoDeletion = (photoId: string) => {
        setPhotoIdsToDelete((current) =>
            current.includes(photoId) ? current.filter((id) => id !== photoId) : [...current, photoId],
        );
    };

    const onSubmit = handleSubmit((values) =>
        submit(values, isEdit ? undefined : stagedPhotos, isEdit ? photoIdsToDelete : undefined),
    );

    /**
     * 編集モードで既存値が渡されている場合は手動扱いで初期化する。
     * 新規作成は自動計算モードで開始し、ユーザーが潜水時間を編集した時点で停止する。
     */
    const [isBottomTimeAutoCalc, setIsBottomTimeAutoCalc] = useState(defaultValues?.bottomTimeMin == null);

    const entryTime = watch('entryTime');
    const exitTime = watch('exitTime');
    const diveSiteId = watch('diveSiteId') ?? '';

    // バディ配列のエラー（配列要素ごと or ルート）から最初の文言を取り出して表示する
    const buddiesError = errors.buddies;
    const buddyError = Array.isArray(buddiesError)
        ? buddiesError.find((item) => item?.message)?.message
        : buddiesError?.message;

    useEffect(() => {
        if (!isBottomTimeAutoCalc) return;
        const calculated = calcBottomTimeMin(entryTime, exitTime);
        if (calculated === null) return;
        setValue('bottomTimeMin', calculated, { shouldDirty: false, shouldValidate: true });
    }, [entryTime, exitTime, isBottomTimeAutoCalc, setValue]);

    const bottomTimeRegister = register('bottomTimeMin', {
        onChange: () => setIsBottomTimeAutoCalc(false),
    });

    return (
        <form
            onSubmit={(e) => {
                void onSubmit(e);
            }}
            className="flex flex-col gap-6"
            noValidate
        >
            {showNoCreditBanner && <NoCreditBanner />}

            <section aria-labelledby="dive-form-basic" className="flex flex-col gap-4">
                <h2 id="dive-form-basic" className="font-semibold text-lg">
                    基本情報
                </h2>

                <div className="grid grid-cols-2 gap-3">
                    <FormField
                        id="diveNumber"
                        label="ダイブ番号"
                        error={errors.diveNumber?.message}
                        type="number"
                        onWheel={blurOnWheel}
                        onKeyDown={blockNonIntegerKeys}
                        inputMode="numeric"
                        min={0}
                        step={1}
                        autoComplete="off"
                        {...register('diveNumber')}
                    />

                    <FormField
                        id="diveDate"
                        label="潜水日"
                        required
                        error={errors.diveDate?.message}
                        type="date"
                        autoComplete="off"
                        {...register('diveDate')}
                    />
                </div>

                <fieldset className="flex flex-col gap-2">
                    <legend className="font-medium text-sm">
                        ポイント
                        <span aria-hidden="true" className="ml-1 text-red-600">
                            *
                        </span>
                        <span className="sr-only">必須</span>
                    </legend>
                    <p className="text-muted-foreground text-xs">
                        登録済みのダイブサイトを検索して選ぶか、無ければ下の欄にポイント名を入力してください
                    </p>
                    <SearchSelect
                        id="diveSiteId"
                        label="ダイブサイト（マスタから選択）"
                        options={siteOptions}
                        value={diveSiteId}
                        onChange={(value) => {
                            setValue('diveSiteId', value === '' ? null : value, { shouldValidate: true });
                            // サイト選択時は自由入力を空にして排他にする
                            if (value) setValue('location', '', { shouldValidate: true });
                        }}
                        placeholder="ポイント名・エリアで検索"
                        error={errors.diveSiteId?.message}
                    />
                    <FormField
                        id="location"
                        label="ポイント名（マスタに無い場合に直接入力）"
                        error={errors.location?.message}
                        type="text"
                        autoComplete="off"
                        {...register('location', {
                            // 自由入力したらサイト選択を解除して排他にする
                            onChange: (e: ChangeEvent<HTMLInputElement>) => {
                                if (e.target.value) setValue('diveSiteId', null, { shouldValidate: true });
                            },
                        })}
                    />
                </fieldset>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <FormField
                        id="entryTime"
                        label="エントリー時刻"
                        type="time"
                        autoComplete="off"
                        {...register('entryTime')}
                    />

                    <FormField
                        id="exitTime"
                        label="エキジット時刻"
                        type="time"
                        autoComplete="off"
                        {...register('exitTime')}
                    />

                    <FormField
                        id="pressureStartBar"
                        label="開始残圧(bar)"
                        type="number"
                        onWheel={blurOnWheel}
                        inputMode="numeric"
                        step={5}
                        min={0}
                        max={400}
                        autoComplete="off"
                        {...register('pressureStartBar')}
                    />

                    <FormField
                        id="pressureEndBar"
                        label="終了残圧(bar)"
                        error={errors.pressureEndBar?.message}
                        type="number"
                        onWheel={blurOnWheel}
                        inputMode="numeric"
                        step={5}
                        min={0}
                        max={400}
                        autoComplete="off"
                        {...register('pressureEndBar')}
                    />
                </div>

                <FormSelect
                    id="diveType"
                    label="ダイブタイプ"
                    options={DIVE_TYPE_OPTIONS}
                    placeholder="選択しない"
                    {...register('diveType')}
                />

                {/* ショップ紐付け（033 / FR-008）。選択肢は page 側から注入される。0 件時は登録導線を表示する */}
                {shopOptions.length > 0 ? (
                    <FormSelect
                        id="diveShopId"
                        label="ショップ"
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
                        するとログに紐付けできます
                    </p>
                )}
            </section>

            <section aria-labelledby="dive-form-numbers" className="flex flex-col gap-4">
                <h2 id="dive-form-numbers" className="font-semibold text-lg">
                    水深・時間
                </h2>

                <div className="grid grid-cols-3 gap-3">
                    <FormField
                        id="maxDepthM"
                        label="最大水深(m)"
                        required
                        error={errors.maxDepthM?.message}
                        type="number"
                        onWheel={blurOnWheel}
                        inputMode="decimal"
                        step="0.1"
                        min={0}
                        max={300}
                        autoComplete="off"
                        {...register('maxDepthM')}
                    />

                    <FormField
                        id="avgDepthM"
                        label="平均水深(m)"
                        error={errors.avgDepthM?.message}
                        type="number"
                        onWheel={blurOnWheel}
                        inputMode="decimal"
                        step="0.1"
                        min={0}
                        max={300}
                        autoComplete="off"
                        {...register('avgDepthM')}
                    />

                    {/* 自動計算ヒントは FormField 非対応のため外側に置き、aria-describedby を明示的に上書きする */}
                    <div className="flex flex-col gap-1">
                        <FormField
                            id="bottomTimeMin"
                            label="潜水時間(分)"
                            required
                            error={errors.bottomTimeMin?.message}
                            type="number"
                            onWheel={blurOnWheel}
                            inputMode="numeric"
                            step={1}
                            min={1}
                            max={1440}
                            autoComplete="off"
                            aria-describedby={
                                errors.bottomTimeMin
                                    ? 'bottomTimeMin-error'
                                    : isBottomTimeAutoCalc
                                      ? 'bottomTimeMin-hint'
                                      : undefined
                            }
                            {...bottomTimeRegister}
                        />
                        {isBottomTimeAutoCalc && !errors.bottomTimeMin && (
                            <span id="bottomTimeMin-hint" className="text-muted-foreground text-xs">
                                エントリー / エキジット時刻から自動計算します
                            </span>
                        )}
                    </div>
                </div>
            </section>

            <section aria-labelledby="dive-form-condition" className="flex flex-col gap-4">
                <h2 id="dive-form-condition" className="font-semibold text-lg">
                    コンディション
                </h2>

                <div className="grid grid-cols-3 gap-3">
                    <FormField
                        id="airTempC"
                        label="気温(℃)"
                        type="number"
                        onWheel={blurOnWheel}
                        inputMode="decimal"
                        step="0.1"
                        autoComplete="off"
                        {...register('airTempC')}
                    />
                    <FormField
                        id="waterTempC"
                        label="水温(℃)"
                        type="number"
                        onWheel={blurOnWheel}
                        inputMode="decimal"
                        step="0.1"
                        autoComplete="off"
                        {...register('waterTempC')}
                    />
                    <FormField
                        id="visibilityM"
                        label="透明度(m)"
                        type="number"
                        onWheel={blurOnWheel}
                        inputMode="decimal"
                        step="0.1"
                        min={0}
                        max={100}
                        autoComplete="off"
                        {...register('visibilityM')}
                    />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <FormField id="weather" label="天気" type="text" autoComplete="off" {...register('weather')} />
                    <FormField id="wave" label="波・うねり" type="text" autoComplete="off" {...register('wave')} />
                    <FormField
                        id="currentCondition"
                        label="流れ"
                        type="text"
                        autoComplete="off"
                        {...register('currentCondition')}
                    />
                </div>
            </section>

            <section aria-labelledby="dive-form-equipment" className="flex flex-col gap-4">
                <h2 id="dive-form-equipment" className="font-semibold text-lg">
                    タンク・装備
                </h2>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <FormSelect
                        id="tankType"
                        label="タンク種別"
                        options={TANK_TYPE_OPTIONS}
                        placeholder="選択しない"
                        {...register('tankType')}
                    />
                    <FormField
                        id="tankVolumeL"
                        label="タンク容量(L)"
                        type="number"
                        onWheel={blurOnWheel}
                        inputMode="decimal"
                        step="0.1"
                        min={0}
                        autoComplete="off"
                        {...register('tankVolumeL')}
                    />
                    <FormSelect
                        id="gasType"
                        label="ガス種類"
                        options={GAS_TYPE_OPTIONS}
                        placeholder="選択しない"
                        {...register('gasType')}
                    />
                    <FormField
                        id="o2Percent"
                        label="酸素濃度(%)"
                        type="number"
                        onWheel={blurOnWheel}
                        inputMode="decimal"
                        step="0.1"
                        min={0}
                        max={100}
                        autoComplete="off"
                        {...register('o2Percent')}
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <FormField
                        id="weightKg"
                        label="ウェイト(kg)"
                        type="number"
                        onWheel={blurOnWheel}
                        inputMode="decimal"
                        step="0.1"
                        min={0}
                        max={30}
                        autoComplete="off"
                        {...register('weightKg')}
                    />
                    <FormField
                        id="suitType"
                        label="スーツ"
                        type="text"
                        maxLength={40}
                        autoComplete="off"
                        placeholder="例: ウェット 5mm"
                        {...register('suitType')}
                    />
                </div>

                <FormTextarea id="equipmentNotes" label="装備メモ" rows={2} {...register('equipmentNotes')} />
            </section>

            <section aria-labelledby="dive-form-others" className="flex flex-col gap-4">
                <h2 id="dive-form-others" className="font-semibold text-lg">
                    バディ・メモ
                </h2>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField
                        id="buddyName"
                        label="バディ名"
                        type="text"
                        autoComplete="off"
                        {...register('buddyName')}
                    />
                    <FormField
                        id="instructorName"
                        label="インストラクター名"
                        type="text"
                        autoComplete="off"
                        {...register('instructorName')}
                    />
                </div>

                <DiveBuddyField
                    value={watch('buddies') ?? []}
                    onChange={(next) => setValue('buddies', next, { shouldValidate: true, shouldDirty: true })}
                    error={buddyError}
                />

                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" {...register('certificationDive')} />
                    講習ダイブ
                </label>

                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" {...register('isPublic')} />
                    このログを公開する（フォロワー・共有リンクから閲覧可能になります）
                </label>

                <FormTextarea id="notes" label="メモ・印象" rows={4} {...register('notes')} />
            </section>

            {isEdit && existingPhotos.length > 0 && (
                <section aria-labelledby="dive-form-existing-photos" className="flex flex-col gap-3">
                    <h2 id="dive-form-existing-photos" className="font-semibold text-lg">
                        写真
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        ✕ を押した写真は保存時に削除されます。もう一度押すと取り消せます。
                    </p>
                    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {existingPhotos.map((photo) => {
                            const isMarked = photoIdsToDelete.includes(photo.id);
                            return (
                                <li key={photo.id} className="relative">
                                    <div className={isMarked ? 'opacity-40 grayscale' : undefined}>
                                        <PhotoThumbnail src={photo.thumbUrl} alt={photo.alt} unoptimized />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => togglePhotoDeletion(photo.id)}
                                        aria-pressed={isMarked}
                                        aria-label={isMarked ? `${photo.alt} の削除を取り消す` : `${photo.alt} を削除`}
                                        className="absolute top-1 right-1 inline-flex size-7 items-center justify-center rounded-full bg-foreground/70 text-background hover:bg-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                                    >
                                        <XIcon className="size-4" aria-hidden="true" />
                                    </button>
                                    {isMarked && (
                                        <span className="absolute bottom-1 left-1 rounded bg-destructive px-1.5 py-0.5 text-destructive-foreground text-xs">
                                            削除予定
                                        </span>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </section>
            )}

            {!isEdit && (
                <section aria-labelledby="dive-form-photos" className="flex flex-col gap-3">
                    <h2 id="dive-form-photos" className="font-semibold text-lg">
                        写真
                    </h2>
                    <label htmlFor="dive-form-photo-input" className="text-sm">
                        写真を選択（任意・最大 10 枚）
                    </label>
                    <input
                        id="dive-form-photo-input"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                        multiple
                        onChange={handlePhotosChange}
                        className="text-sm"
                    />
                    {previewUrls.length > 0 && (
                        <ul className="flex flex-wrap gap-2">
                            {previewUrls.map((url, index) => (
                                <li
                                    key={url}
                                    className="relative h-24 w-24 overflow-hidden rounded-md border border-border"
                                >
                                    <Image
                                        src={url}
                                        alt={`選択した写真 ${index + 1}`}
                                        fill
                                        sizes="96px"
                                        unoptimized
                                        className="object-cover"
                                    />
                                </li>
                            ))}
                        </ul>
                    )}
                    {stagedPhotos.length > 0 && (
                        <p className="text-muted-foreground text-sm">
                            {stagedPhotos.length} 枚を選択中（保存時に添付）
                        </p>
                    )}
                    {photoErrors.length > 0 && (
                        <div role="alert">
                            <ul className="flex flex-col gap-1 text-destructive text-sm">
                                {photoErrors.map((message) => (
                                    <li key={message}>{message}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </section>
            )}

            {serverError && (
                <div role="alert" className="text-red-600 text-sm">
                    {serverError}
                </div>
            )}

            {serverWarning && (
                <div role="alert" className="text-amber-700 text-sm">
                    {serverWarning}
                </div>
            )}

            <div className="flex items-center justify-end gap-2">
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                        router.back();
                    }}
                >
                    キャンセル
                </Button>
                <Button type="submit" disabled={isPending} aria-busy={isPending}>
                    {isPending ? '保存中...' : isEdit ? '更新する' : '作成する'}
                </Button>
            </div>
        </form>
    );
};
