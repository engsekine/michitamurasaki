'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deletePlan } from '@/features/plans/server/actions';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import { Button } from '@/shared/components/ui/Button';

interface DeletePlanButtonProps {
    planId: string;
}

export const DeletePlanButton = ({ planId }: DeletePlanButtonProps) => {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const handleOpen = () => {
        setError(null);
        setOpen(true);
    };

    const handleConfirm = () => {
        setError(null);
        startTransition(async () => {
            const result = await deletePlan(planId);
            setOpen(false);
            if (!result.success) {
                setError(result.error);
                return;
            }
            router.push('/plans');
            router.refresh();
        });
    };

    return (
        <>
            <Button variant="destructive" onClick={handleOpen}>
                削除
            </Button>
            {error && (
                <p role="alert" className="text-red-600 text-sm">
                    {error}
                </p>
            )}
            <ConfirmDialog
                open={open}
                onOpenChange={setOpen}
                title="予定を削除しますか？"
                description="削除すると持ち物リストも含めて元に戻せません。本当に削除してよろしいですか？"
                confirmLabel="削除する"
                destructive
                isPending={isPending}
                onConfirm={handleConfirm}
            />
        </>
    );
};
