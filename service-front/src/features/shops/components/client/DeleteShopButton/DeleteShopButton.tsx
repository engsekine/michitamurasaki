'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { deleteShop } from '@/features/shops/server/actions';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import { Button } from '@/shared/components/ui/Button';

interface DeleteShopButtonProps {
    shopId: string;
}

export const DeleteShopButton = ({ shopId }: DeleteShopButtonProps) => {
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
            const result = await deleteShop(shopId);
            setOpen(false);
            if (!result.success) {
                setError(result.error);
                return;
            }
            router.push('/shops');
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
                title="ショップを削除しますか？"
                description="削除すると元に戻せません。予定・ログ・申し込みシートは残り、このショップとの紐付けだけが解除されます。"
                confirmLabel="削除する"
                destructive
                isPending={isPending}
                onConfirm={handleConfirm}
            />
        </>
    );
};
