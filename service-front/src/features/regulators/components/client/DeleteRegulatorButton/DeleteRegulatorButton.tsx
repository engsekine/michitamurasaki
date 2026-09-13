'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteRegulator } from '@/features/regulators/server/actions';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import { Button } from '@/shared/components/ui/Button';

interface DeleteRegulatorButtonProps {
    regulatorId: string;
    /** 確認ダイアログに表示する機材名（例: ブランド + モデル名） */
    name: string;
}

export const DeleteRegulatorButton = ({ regulatorId, name }: DeleteRegulatorButtonProps) => {
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
            const result = await deleteRegulator(regulatorId);
            setOpen(false);
            if (!result.success) {
                setError(result.error);
                return;
            }
            // 機材一覧ページ内で使うため遷移は不要。再フェッチのみ行う
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
                title={`${name} を削除しますか？`}
                description="削除するとオーバーホール履歴も含めて元に戻せません。本当に削除してよろしいですか？"
                confirmLabel="削除する"
                destructive
                isPending={isPending}
                onConfirm={handleConfirm}
            />
        </>
    );
};
