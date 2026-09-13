'use client';

import { useState, useTransition } from 'react';
import { deleteDive } from '@/features/dives/server/actions';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import { Button } from '@/shared/components/ui/Button';

interface DeleteDiveButtonProps {
    diveId: string;
}

export const DeleteDiveButton = ({ diveId }: DeleteDiveButtonProps) => {
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
            const result = await deleteDive(diveId);
            // 成功時は server action 側の redirect で /dives へ遷移する
            if (!result.success) {
                setOpen(false);
                setError(result.error);
            }
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
                title="ログを削除しますか？"
                description="削除すると元に戻せません。本当に削除してよろしいですか？"
                confirmLabel="削除する"
                destructive
                isPending={isPending}
                onConfirm={handleConfirm}
            />
        </>
    );
};
