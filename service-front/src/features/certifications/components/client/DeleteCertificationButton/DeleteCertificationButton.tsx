'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteCertification } from '@/features/certifications/server/actions';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import { Button } from '@/shared/components/ui/Button';

interface DeleteCertificationButtonProps {
    certificationId: string;
    /** 確認ダイアログに表示する資格名（例: 指導団体ラベル + ランク名） */
    name: string;
}

export const DeleteCertificationButton = ({ certificationId, name }: DeleteCertificationButtonProps) => {
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
            const result = await deleteCertification(certificationId);
            setOpen(false);
            if (!result.success) {
                setError(result.error);
                return;
            }
            // 資格一覧ページ内で使うため遷移は不要。再フェッチのみ行う
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
                description="削除すると元に戻せません。本当に削除してよろしいですか？"
                confirmLabel="削除する"
                destructive
                isPending={isPending}
                onConfirm={handleConfirm}
            />
        </>
    );
};
