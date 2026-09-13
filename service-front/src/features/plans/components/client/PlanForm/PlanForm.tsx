'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { type PlanFormValues, planSchema } from '@/features/plans/schemas/plan.schema';
import { createPlan, updatePlan } from '@/features/plans/server/actions';
import { FormField, FormSelect, FormTextarea } from '@/shared/components/form';
import { Button, buttonVariants } from '@/shared/components/ui/Button';
import { todayInJst } from '@/shared/lib/date';

interface PlanFormProps {
    /** 編集対象の予定 ID（未指定なら新規作成モード） */
    planId?: string;
    defaultValues?: Partial<PlanFormValues>;
    /** ショップ選択肢（033）。page 側で features/shops から取得して注入する（feature 間 import 禁止のため） */
    shopOptions?: ReadonlyArray<{ id: string; name: string }>;
}

const createDefaultValues = (overrides?: Partial<PlanFormValues>): PlanFormValues => ({
    plannedOn: todayInJst(),
    location: '',
    notes: null,
    diveShopId: null,
    ...overrides,
});

export const PlanForm = ({ planId, defaultValues, shopOptions = [] }: PlanFormProps) => {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [serverError, setServerError] = useState<string | null>(null);

    const isEdit = planId !== undefined;

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<PlanFormValues>({
        resolver: yupResolver(planSchema),
        defaultValues: createDefaultValues(defaultValues),
    });

    const onSubmit = handleSubmit((values) => {
        setServerError(null);
        startTransition(async () => {
            if (isEdit) {
                const result = await updatePlan(planId, values);
                if (!result.success) {
                    setServerError(result.error);
                    return;
                }
                router.push(`/plans/${planId}`);
                router.refresh();
                return;
            }

            const result = await createPlan(values);
            if (!result.success) {
                setServerError(result.error);
                return;
            }
            router.push(`/plans/${result.id}`);
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
                id="plannedOn"
                label="予定日"
                required
                error={errors.plannedOn?.message}
                type="date"
                autoComplete="off"
                {...register('plannedOn')}
            />

            <FormField
                id="location"
                label="ポイント名"
                required
                error={errors.location?.message}
                type="text"
                placeholder="例: 伊豆 / 大瀬崎"
                autoComplete="off"
                {...register('location')}
            />

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
                    すると予定に紐付けできます
                </p>
            )}

            <FormTextarea id="notes" label="メモ" rows={4} error={errors.notes?.message} {...register('notes')} />

            <div className="flex items-center justify-end gap-2">
                <Link href="/plans" className={buttonVariants({ variant: 'outline' })}>
                    キャンセル
                </Link>
                <Button type="submit" disabled={isPending} aria-busy={isPending}>
                    {isPending ? '保存中...' : isEdit ? '更新する' : '作成する'}
                </Button>
            </div>
        </form>
    );
};
