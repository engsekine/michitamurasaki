'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { OVERHAUL_INTERVAL_DIVES, OVERHAUL_INTERVAL_MONTHS } from '@/features/regulators/constants';
import { type RegulatorFormValues, regulatorSchema } from '@/features/regulators/schemas/regulator.schema';
import { createRegulator, updateRegulator } from '@/features/regulators/server/actions';
import { FormField, FormTextarea } from '@/shared/components/form';
import { Button, buttonVariants } from '@/shared/components/ui/Button';

interface RegulatorFormProps {
    /** 編集対象のレギュレーター ID（未指定なら新規登録モード） */
    regulatorId?: string;
    defaultValues?: Partial<RegulatorFormValues>;
}

const createDefaultValues = (overrides?: Partial<RegulatorFormValues>): RegulatorFormValues => ({
    brand: '',
    model: '',
    purchasedOn: null,
    lastOverhauledOn: '',
    overhaulIntervalMonths: OVERHAUL_INTERVAL_MONTHS.default,
    overhaulIntervalDives: OVERHAUL_INTERVAL_DIVES.default,
    isPrimary: false,
    notes: null,
    ...overrides,
});

export const RegulatorForm = ({ regulatorId, defaultValues }: RegulatorFormProps) => {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [serverError, setServerError] = useState<string | null>(null);

    const isEdit = regulatorId !== undefined;

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<RegulatorFormValues>({
        resolver: yupResolver(regulatorSchema),
        defaultValues: createDefaultValues(defaultValues),
    });

    const onSubmit = handleSubmit((values) => {
        setServerError(null);
        startTransition(async () => {
            const result = isEdit ? await updateRegulator(regulatorId, values) : await createRegulator(values);
            if (!result.success) {
                setServerError(result.error);
                return;
            }
            router.push('/settings/equipment');
            router.refresh();
        });
    });

    return (
        <form
            onSubmit={(e) => {
                void onSubmit(e);
            }}
            className="flex flex-col gap-4"
            noValidate
        >
            {serverError && (
                <div role="alert" className="text-red-600 text-sm">
                    {serverError}
                </div>
            )}

            <FormField
                id="brand"
                label="メーカー名"
                required
                error={errors.brand?.message}
                type="text"
                placeholder="例: SCUBAPRO"
                autoComplete="off"
                {...register('brand')}
            />

            <FormField
                id="model"
                label="モデル名"
                required
                error={errors.model?.message}
                type="text"
                placeholder="例: MK25 EVO / S620Ti"
                autoComplete="off"
                {...register('model')}
            />

            <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                    id="purchasedOn"
                    label="購入日"
                    error={errors.purchasedOn?.message}
                    type="date"
                    autoComplete="off"
                    {...register('purchasedOn')}
                />

                <FormField
                    id="lastOverhauledOn"
                    label="前回オーバーホール日"
                    required
                    error={errors.lastOverhauledOn?.message}
                    type="date"
                    autoComplete="off"
                    {...register('lastOverhauledOn')}
                />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                    id="overhaulIntervalMonths"
                    label="OH 周期（月）"
                    error={errors.overhaulIntervalMonths?.message}
                    type="number"
                    min={OVERHAUL_INTERVAL_MONTHS.min}
                    max={OVERHAUL_INTERVAL_MONTHS.max}
                    {...register('overhaulIntervalMonths')}
                />

                <FormField
                    id="overhaulIntervalDives"
                    label="OH 周期（本数）"
                    error={errors.overhaulIntervalDives?.message}
                    type="number"
                    min={OVERHAUL_INTERVAL_DIVES.min}
                    max={OVERHAUL_INTERVAL_DIVES.max}
                    {...register('overhaulIntervalDives')}
                />
            </div>

            <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register('isPrimary')} />
                メイン機材にする
            </label>

            <FormTextarea id="notes" label="メモ" rows={3} error={errors.notes?.message} {...register('notes')} />

            <div className="flex items-center justify-end gap-2">
                <Link href="/settings/equipment" className={buttonVariants({ variant: 'outline' })}>
                    キャンセル
                </Link>
                <Button type="submit" disabled={isPending} aria-busy={isPending}>
                    {isPending ? '保存中...' : isEdit ? '更新する' : '登録する'}
                </Button>
            </div>
        </form>
    );
};
