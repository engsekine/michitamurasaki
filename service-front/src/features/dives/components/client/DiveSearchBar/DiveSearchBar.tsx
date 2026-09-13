'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { DIVE_TYPE_OPTIONS } from '@/features/dives/constants';
import { blockNonIntegerKeys, blurOnWheel } from '@/features/dives/lib/numericInput';
import { type DiveSearchValues, diveSearchSchema } from '@/features/dives/schemas/dive.schema';
import type { DiveListFilter } from '@/features/dives/types';
import { FormField } from '@/shared/components/form';
import { Button } from '@/shared/components/ui/Button';

interface DiveSearchBarProps {
    initialFilter?: DiveListFilter;
    onSubmit: (filter: DiveListFilter) => void;
}

/** 詳細条件パネルに入るフィルタ（常時表示の番号・ポイント名を除く） */
const countAdvancedFilters = (filter: DiveListFilter | undefined): number => {
    if (!filter) return 0;
    const keys: (keyof DiveListFilter)[] = ['dateFrom', 'dateTo', 'depthMin', 'depthMax', 'diveType', 'buddyName'];
    return keys.filter((key) => filter[key] !== undefined).length;
};

const ADVANCED_PANEL_ID = 'dive-advanced-filters';

export const DiveSearchBar = ({ initialFilter, onSubmit: onSubmitFilter }: DiveSearchBarProps) => {
    const appliedAdvancedCount = countAdvancedFilters(initialFilter);
    // 適用中の詳細フィルタがあれば初期状態で開く（URL 復元時に隠れないように）
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(appliedAdvancedCount > 0);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<DiveSearchValues>({
        resolver: yupResolver(diveSearchSchema),
        defaultValues: {
            diveNumber: initialFilter?.diveNumber ?? null,
            dateFrom: initialFilter?.dateFrom ?? null,
            dateTo: initialFilter?.dateTo ?? null,
            depthMin: initialFilter?.depthMin ?? null,
            depthMax: initialFilter?.depthMax ?? null,
            diveType: initialFilter?.diveType ?? null,
            location: initialFilter?.location ?? null,
            buddyName: initialFilter?.buddyName ?? null,
        },
    });

    const onSubmit = handleSubmit((values) => {
        const filter: DiveListFilter = {};
        if (values.diveNumber != null) filter.diveNumber = values.diveNumber;
        if (values.dateFrom) filter.dateFrom = values.dateFrom;
        if (values.dateTo) filter.dateTo = values.dateTo;
        if (values.depthMin != null) filter.depthMin = values.depthMin;
        if (values.depthMax != null) filter.depthMax = values.depthMax;
        if (values.diveType) filter.diveType = values.diveType;
        if (values.location) filter.location = values.location;
        if (values.buddyName) filter.buddyName = values.buddyName;
        onSubmitFilter(filter);
    });

    const handleClear = () => {
        reset({
            diveNumber: null,
            dateFrom: null,
            dateTo: null,
            depthMin: null,
            depthMax: null,
            diveType: null,
            location: null,
            buddyName: null,
        });
        onSubmitFilter({});
    };

    return (
        <search aria-label="ダイビングログ検索">
            <form
                onSubmit={(e) => {
                    void onSubmit(e);
                }}
                className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4"
            >
                {/* 常時表示: 番号・ポイント名 */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField
                        id="dive-search-number"
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
                        id="dive-search-location"
                        label="ポイント名（部分一致）"
                        error={errors.location?.message}
                        type="text"
                        autoComplete="off"
                        placeholder="例: 伊豆"
                        {...register('location')}
                    />
                </div>

                {/* 詳細条件: 折りたたみ（disclosure） */}
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        aria-expanded={isAdvancedOpen}
                        aria-controls={ADVANCED_PANEL_ID}
                        onClick={() => setIsAdvancedOpen((open) => !open)}
                        className="font-medium text-primary text-sm underline-offset-2 hover:underline"
                    >
                        {isAdvancedOpen ? '詳細条件を閉じる' : '詳細条件を開く'}
                    </button>
                    {!isAdvancedOpen && appliedAdvancedCount > 0 && (
                        <span className="text-muted-foreground text-sm">詳細条件: {appliedAdvancedCount} 件適用中</span>
                    )}
                </div>

                <div id={ADVANCED_PANEL_ID} hidden={!isAdvancedOpen} className="flex flex-col gap-3">
                    {/* 期間（FR-001） */}
                    <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <legend className="mb-1 font-medium text-sm">期間（潜水日）</legend>
                        <FormField
                            id="dive-search-date-from"
                            label="開始日"
                            error={errors.dateFrom?.message}
                            type="date"
                            autoComplete="off"
                            {...register('dateFrom')}
                        />
                        <FormField
                            id="dive-search-date-to"
                            label="終了日"
                            error={errors.dateTo?.message}
                            type="date"
                            autoComplete="off"
                            {...register('dateTo')}
                        />
                    </fieldset>

                    {/* 深度範囲（FR-002・最大水深） */}
                    <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <legend className="mb-1 font-medium text-sm">最大水深（m）</legend>
                        <FormField
                            id="dive-search-depth-min"
                            label="下限"
                            error={errors.depthMin?.message}
                            type="number"
                            onWheel={blurOnWheel}
                            inputMode="decimal"
                            min={0}
                            max={300}
                            step="0.1"
                            autoComplete="off"
                            {...register('depthMin')}
                        />
                        <FormField
                            id="dive-search-depth-max"
                            label="上限"
                            error={errors.depthMax?.message}
                            type="number"
                            onWheel={blurOnWheel}
                            inputMode="decimal"
                            min={0}
                            max={300}
                            step="0.1"
                            autoComplete="off"
                            {...register('depthMax')}
                        />
                    </fieldset>

                    {/* ダイブタイプ（FR-003） */}
                    <div className="flex flex-col gap-1">
                        <label htmlFor="dive-search-type" className="font-medium text-sm">
                            ダイブタイプ
                        </label>
                        <select
                            id="dive-search-type"
                            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                            {...register('diveType')}
                        >
                            <option value="">指定しない</option>
                            {DIVE_TYPE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* バディ名（spec 021 FR-022）: フリーテキスト名の部分一致 */}
                    <FormField
                        id="dive-search-buddy-name"
                        label="バディ名（部分一致）"
                        error={errors.buddyName?.message}
                        type="text"
                        autoComplete="off"
                        {...register('buddyName')}
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Button type="submit">検索</Button>
                    <Button type="button" variant="outline" onClick={handleClear}>
                        クリア
                    </Button>
                </div>
            </form>
        </search>
    );
};
