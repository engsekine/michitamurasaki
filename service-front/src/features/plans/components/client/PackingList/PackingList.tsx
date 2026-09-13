'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { type PackingItemFormValues, packingItemSchema } from '@/features/plans/schemas/plan.schema';
import { addPackingItem, completePacking, deletePackingItem, togglePackingItem } from '@/features/plans/server/actions';
import type { PackingItem } from '@/features/plans/types';
import { FormField } from '@/shared/components/form';
import { Button } from '@/shared/components/ui/Button';
import type { ActionResult } from '@/shared/types/action-result';

interface PackingListProps {
    planId: string;
    items: PackingItem[];
    /**
     * 「準備完了にする」ボタンを表示するか（037）。終了済み予定では親が false を渡す（FR-009）。
     * 持ち物 0 件時はこの値にかかわらず表示しない（FR-007）
     */
    canComplete?: boolean;
}

export const PackingList = ({ planId, items, canComplete = false }: PackingListProps) => {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [serverError, setServerError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<PackingItemFormValues>({
        resolver: yupResolver(packingItemSchema),
        defaultValues: { name: '' },
    });

    const checkedCount = items.filter((item) => item.isChecked).length;
    const isAllChecked = items.length > 0 && checkedCount === items.length;

    /** Server Action を実行し、成功時は表示を最新化・失敗時はエラーを表示する */
    const runAction = (action: () => Promise<ActionResult>, onSuccess?: () => void) => {
        setServerError(null);
        startTransition(async () => {
            const result = await action();
            if (!result.success) {
                setServerError(result.error);
                return;
            }
            onSuccess?.();
            router.refresh();
        });
    };

    const handleToggle = (item: PackingItem) => {
        runAction(() => togglePackingItem(item.id, !item.isChecked));
    };

    const handleDelete = (item: PackingItem) => {
        runAction(() => deletePackingItem(item.id));
    };

    const handleAdd = handleSubmit((values) => {
        runAction(
            () => addPackingItem(planId, values.name),
            () => reset(),
        );
    });

    const handleComplete = () => {
        runAction(() => completePacking(planId));
    };

    return (
        <section className="flex flex-col gap-4">
            {/* 進捗はスクリーンリーダーにも更新が伝わるよう aria-live で通知する */}
            <p aria-live="polite" className="text-sm">
                {`${checkedCount} / ${items.length} 準備済み`}
                {isAllChecked && <span className="ml-2 font-medium text-green-700">準備完了</span>}
            </p>

            {serverError && (
                <p role="alert" className="text-red-600 text-sm">
                    {serverError}
                </p>
            )}

            <ul className="flex flex-col gap-2">
                {items.map((item) => {
                    const checkboxId = `packing-item-${item.id}`;
                    return (
                        <li key={item.id} className="flex items-center gap-2">
                            <input
                                id={checkboxId}
                                type="checkbox"
                                checked={item.isChecked}
                                disabled={isPending}
                                onChange={() => handleToggle(item)}
                                className="size-4"
                            />
                            <label htmlFor={checkboxId} className="flex-1 text-sm">
                                {item.name}
                            </label>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={isPending}
                                aria-label={`${item.name} を削除`}
                                onClick={() => handleDelete(item)}
                            >
                                削除
                            </Button>
                        </li>
                    );
                })}
            </ul>

            <form noValidate onSubmit={handleAdd} className="flex items-end gap-2">
                <div className="flex-1">
                    <FormField
                        id="packing-item-name"
                        label="持ち物を追加"
                        error={errors.name?.message}
                        {...register('name')}
                    />
                </div>
                <Button type="submit" disabled={isPending}>
                    追加
                </Button>
            </form>

            {/* 準備完了（037）。未チェックが残っていても押せる（FR-002）。0 件・終了済みでは非表示 */}
            {canComplete && items.length > 0 && (
                <div className="flex">
                    <Button type="button" disabled={isPending} onClick={handleComplete}>
                        準備完了にする
                    </Button>
                </div>
            )}
        </section>
    );
};
